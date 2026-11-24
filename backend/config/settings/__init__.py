"""Paquete de configuración por entorno.

Este archivo queda vacío a propósito: los settings viven en `base.py`
(compartido) y en los módulos `development.py` y `production.py`, que son los
que se seleccionan con `DJANGO_SETTINGS_MODULE`.

No hay que apuntar `DJANGO_SETTINGS_MODULE` a este paquete: `manage.py`
selecciona `config.settings.development` y `wsgi.py` / `asgi.py` seleccionan
`config.settings.production`. La variable de entorno sigue funcionando si
alguien quiere forzar otro módulo, porque los tres usan `setdefault`.
"""
