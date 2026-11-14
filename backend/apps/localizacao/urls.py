from django.urls import path

from . import views

urlpatterns = [
    path("distritos/", views.distritos, name="distritos"),
    path("concelhos/", views.concelhos, name="concelhos"),
    path("freguesias/", views.freguesias, name="freguesias"),
]
