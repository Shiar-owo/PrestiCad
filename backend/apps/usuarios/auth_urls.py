from django.urls import path

from apps.usuarios.views import AuthLoginView, AuthLogoutView

urlpatterns = [
    path("login/", AuthLoginView.as_view(), name="login"),
    path("logout/", AuthLogoutView.as_view(), name="logout"),
]