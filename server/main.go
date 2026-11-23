// Servidor da app Orçamento: PocketBase + hooks/migrações em JavaScript + frontend estático.
package main

import (
	"log"
	"os"
	"path/filepath"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/jsvm"
	"github.com/pocketbase/pocketbase/plugins/migratecmd"
)

func main() {
	app := pocketbase.New()

	// pb_migrations e pb_hooks ficam ao lado da pasta pb_data
	jsvm.MustRegister(app, jsvm.Config{})
	migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{
		TemplateLang: migratecmd.TemplateLangJS,
	})

	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		registarRotasPasskeys(se)

		publicDir := filepath.Join(app.DataDir(), "..", "pb_public")
		estaticos := apis.Static(os.DirFS(publicDir), true)
		se.Router.GET("/{path...}", func(e *core.RequestEvent) error {
			// obriga o browser a confirmar se há versão nova (evita ficar com código antigo após atualizar)
			e.Response.Header().Set("Cache-Control", "no-cache")
			return estaticos(e)
		})
		return se.Next()
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}
