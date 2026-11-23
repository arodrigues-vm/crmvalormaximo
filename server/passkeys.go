// Entrada com impressão digital / Face ID / Windows Hello (WebAuthn "passkeys").
//
// O servidor guarda apenas a chave pública de cada aparelho (coleção "passkeys");
// a impressão digital nunca sai do telemóvel/computador.
package main

import (
	"bytes"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

// ------------------------------------------------------------------ utilizador WebAuthn
type utilizadorPk struct {
	rec   *core.Record
	creds []webauthn.Credential
}

func (u *utilizadorPk) WebAuthnID() []byte   { return []byte(u.rec.Id) }
func (u *utilizadorPk) WebAuthnName() string { return u.rec.Email() }
func (u *utilizadorPk) WebAuthnDisplayName() string {
	if n := u.rec.GetString("name"); n != "" {
		return n
	}
	return u.rec.Email()
}
func (u *utilizadorPk) WebAuthnCredentials() []webauthn.Credential { return u.creds }

func carregarUtilizadorPk(app core.App, userID string) (*utilizadorPk, []*core.Record, error) {
	rec, err := app.FindRecordById("users", userID)
	if err != nil {
		return nil, nil, err
	}
	registos, err := app.FindAllRecords("passkeys", dbx.HashExp{"user": userID})
	if err != nil {
		return nil, nil, err
	}
	u := &utilizadorPk{rec: rec}
	for _, r := range registos {
		var c webauthn.Credential
		if json.Unmarshal([]byte(r.GetString("credencial")), &c) == nil {
			u.creds = append(u.creds, c)
		}
	}
	return u, registos, nil
}

// ------------------------------------------------------------------ sessões temporárias (5 min)
type sessaoPk struct {
	dados  webauthn.SessionData
	expira time.Time
}

var (
	sessoesPk   = map[string]sessaoPk{}
	sessoesPkMu sync.Mutex
)

func guardarSessaoPk(chave string, s *webauthn.SessionData) {
	sessoesPkMu.Lock()
	defer sessoesPkMu.Unlock()
	agora := time.Now()
	for k, v := range sessoesPk {
		if agora.After(v.expira) {
			delete(sessoesPk, k)
		}
	}
	sessoesPk[chave] = sessaoPk{dados: *s, expira: agora.Add(5 * time.Minute)}
}

func tirarSessaoPk(chave string) (webauthn.SessionData, bool) {
	sessoesPkMu.Lock()
	defer sessoesPkMu.Unlock()
	s, ok := sessoesPk[chave]
	delete(sessoesPk, chave)
	if !ok || time.Now().After(s.expira) {
		return webauthn.SessionData{}, false
	}
	return s.dados, true
}

func tokenAleatorio() string {
	b := make([]byte, 24)
	_, _ = rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}

// ------------------------------------------------------------------ configuração WebAuthn
// O domínio vem de ORC_URL (ex.: https://orcamento.valormaximo.pt) ou, se não existir, do pedido.
func instanciaWebAuthn(e *core.RequestEvent) (*webauthn.WebAuthn, error) {
	origem := strings.TrimRight(os.Getenv("ORC_URL"), "/")
	if origem == "" {
		esquema := "http"
		if e.Request.TLS != nil || strings.EqualFold(e.Request.Header.Get("X-Forwarded-Proto"), "https") {
			esquema = "https"
		}
		origem = esquema + "://" + e.Request.Host
	}
	host := strings.TrimPrefix(strings.TrimPrefix(origem, "https://"), "http://")
	if h, _, err := net.SplitHostPort(host); err == nil {
		host = h
	}
	return webauthn.New(&webauthn.Config{
		RPID:          host,
		RPDisplayName: "Orçamento",
		RPOrigins:     []string{origem},
	})
}

func erroPk(err error) error {
	msg := "Não foi possível validar a impressão digital."
	if pe, ok := err.(*protocol.Error); ok && pe.DevInfo != "" {
		msg += " (" + pe.DevInfo + ")"
	}
	return apis.NewBadRequestError(msg, nil)
}

// ------------------------------------------------------------------ rotas
func registarRotasPasskeys(se *core.ServeEvent) {
	g := se.Router.Group("/api/orc/passkey")

	// 1) registar este aparelho (utilizador já autenticado)
	g.POST("/registo/inicio", func(e *core.RequestEvent) error {
		wa, err := instanciaWebAuthn(e)
		if err != nil {
			return err
		}
		u, _, err := carregarUtilizadorPk(e.App, e.Auth.Id)
		if err != nil {
			return err
		}
		excluir := make([]protocol.CredentialDescriptor, 0, len(u.creds))
		for _, c := range u.creds {
			excluir = append(excluir, c.Descriptor())
		}
		obrigatorio := true
		opcoes, sessao, err := wa.BeginRegistration(u,
			webauthn.WithAuthenticatorSelection(protocol.AuthenticatorSelection{
				ResidentKey:        protocol.ResidentKeyRequirementRequired,
				RequireResidentKey: &obrigatorio,
				UserVerification:   protocol.VerificationRequired,
			}),
			webauthn.WithExclusions(excluir),
		)
		if err != nil {
			return err
		}
		guardarSessaoPk("reg:"+e.Auth.Id, sessao)
		return e.JSON(http.StatusOK, opcoes)
	}).Bind(apis.RequireAuth("users"))

	g.POST("/registo/fim", func(e *core.RequestEvent) error {
		wa, err := instanciaWebAuthn(e)
		if err != nil {
			return err
		}
		sessao, ok := tirarSessaoPk("reg:" + e.Auth.Id)
		if !ok {
			return apis.NewBadRequestError("O pedido expirou. Tente novamente.", nil)
		}
		u, _, err := carregarUtilizadorPk(e.App, e.Auth.Id)
		if err != nil {
			return err
		}
		resposta, err := protocol.ParseCredentialCreationResponseBody(e.Request.Body)
		if err != nil {
			return erroPk(err)
		}
		cred, err := wa.CreateCredential(u, sessao, resposta)
		if err != nil {
			return erroPk(err)
		}
		col, err := e.App.FindCollectionByNameOrId("passkeys")
		if err != nil {
			return err
		}
		dados, _ := json.Marshal(cred)
		nome := strings.TrimSpace(e.Request.URL.Query().Get("nome"))
		if nome == "" {
			nome = "Aparelho"
		}
		r := core.NewRecord(col)
		r.Set("user", e.Auth.Id)
		r.Set("nome", nome)
		r.Set("credencial_id", base64.RawURLEncoding.EncodeToString(cred.ID))
		r.Set("credencial", string(dados))
		if err := e.App.Save(r); err != nil {
			return err
		}
		return e.JSON(http.StatusOK, map[string]any{"id": r.Id, "credencial_id": r.GetString("credencial_id")})
	}).Bind(apis.RequireAuth("users"))

	// 2) entrar com impressão digital (sem email nem palavra-passe)
	g.POST("/entrar/inicio", func(e *core.RequestEvent) error {
		wa, err := instanciaWebAuthn(e)
		if err != nil {
			return err
		}
		opcoes, sessao, err := wa.BeginDiscoverableLogin(webauthn.WithUserVerification(protocol.VerificationRequired))
		if err != nil {
			return err
		}
		chave := tokenAleatorio()
		guardarSessaoPk("login:"+chave, sessao)
		return e.JSON(http.StatusOK, map[string]any{"sessao": chave, "opcoes": opcoes})
	})

	g.POST("/entrar/fim", func(e *core.RequestEvent) error {
		wa, err := instanciaWebAuthn(e)
		if err != nil {
			return err
		}
		sessao, ok := tirarSessaoPk("login:" + e.Request.URL.Query().Get("sessao"))
		if !ok {
			return apis.NewBadRequestError("O pedido expirou. Tente novamente.", nil)
		}
		// lê o corpo uma vez e repõe-no: o PocketBase volta a lê-lo ao criar a sessão
		corpo, err := io.ReadAll(io.LimitReader(e.Request.Body, 1<<20))
		if err != nil {
			return apis.NewBadRequestError("Pedido inválido.", nil)
		}
		e.Request.Body = io.NopCloser(bytes.NewReader(corpo))
		resposta, err := protocol.ParseCredentialRequestResponseBytes(corpo)
		if err != nil {
			return erroPk(err)
		}
		var registos []*core.Record
		utilizador, cred, err := wa.ValidatePasskeyLogin(func(_, userHandle []byte) (webauthn.User, error) {
			u, rs, err := carregarUtilizadorPk(e.App, string(userHandle))
			registos = rs
			return u, err
		}, sessao, resposta)
		if err != nil {
			return apis.NewUnauthorizedError("Impressão digital não reconhecida neste servidor. Entre com email e palavra-passe e ative-a de novo em Configurar → O meu perfil.", nil)
		}
		// atualiza o contador de utilização da chave (proteção contra clonagem)
		idCred := base64.RawURLEncoding.EncodeToString(cred.ID)
		for _, r := range registos {
			if r.GetString("credencial_id") == idCred {
				dados, _ := json.Marshal(cred)
				r.Set("credencial", string(dados))
				r.Set("ultimo_uso", time.Now().UTC().Format("2006-01-02 15:04:05.000Z"))
				_ = e.App.Save(r)
			}
		}
		rec := utilizador.(*utilizadorPk).rec
		return apis.RecordAuthResponse(e, rec, "passkey", nil)
	})
}
