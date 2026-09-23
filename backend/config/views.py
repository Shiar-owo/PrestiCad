"""Vistas de orquestación (solo infraestructura, sin lógica de negocio)."""
from django.http import JsonResponse


def salud(request):
    """Endpoint de salud para verificar que la API responde."""
    return JsonResponse({"estado": "ok", "servicio": "PrestiCad"})