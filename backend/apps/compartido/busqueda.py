from django.db.models import F, Value
from django.db.models.functions import Concat, Lower, Replace


def expresion_texto_normalizado(campo):
    """Lowercase and remove common Spanish diacritics in a database expression."""
    expresion = Lower(F(campo) if isinstance(campo, str) else campo)
    for con_tilde, sin_tilde in (
        ("á", "a"), ("é", "e"), ("í", "i"), ("ó", "o"), ("ú", "u"), ("ü", "u"),
    ):
        expresion = Replace(expresion, Value(con_tilde), Value(sin_tilde))
    return expresion


def expresion_nombre_completo():
    return expresion_texto_normalizado(Concat(F("nombre"), Value(" "), F("apellido")))


def normalizar_termino(valor):
    return "".join({"á":"a", "é":"e", "í":"i", "ó":"o", "ú":"u", "ü":"u"}.get(c, c) for c in valor.lower())
