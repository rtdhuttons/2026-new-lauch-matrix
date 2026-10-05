"""SVY21 (Singapore's grid, used by URA and OneMap) to WGS84 latitude and
longitude: the inverse transverse Mercator projection with SLA's published
SVY21 parameters."""

import math

A, F = 6378137.0, 1 / 298.257223563
O_LAT, O_LON = 1.366666, 103.833333
O_N, O_E, K = 38744.572, 28001.642, 1.0

B = A * (1 - F)
E2 = 2 * F - F * F
E4, E6 = E2 * E2, E2 ** 3
A0 = 1 - E2 / 4 - 3 * E4 / 64 - 5 * E6 / 256
A2 = 3 / 8 * (E2 + E4 / 4 + 15 * E6 / 128)
A4 = 15 / 256 * (E4 + 3 * E6 / 4)
A6 = 35 * E6 / 3072


def _meridian(lat):
    return A * (A0 * lat - A2 * math.sin(2 * lat) + A4 * math.sin(4 * lat) - A6 * math.sin(6 * lat))


def to_latlon(n, e):
    """Northing and easting in metres -> (latitude, longitude) in degrees."""
    n1 = (A - B) / (A + B)
    n2, n3, n4 = n1 ** 2, n1 ** 3, n1 ** 4
    g = A * (1 - n1) * (1 - n2) * (1 + 9 * n2 / 4 + 225 * n4 / 64) * (math.pi / 180)
    m = _meridian(math.radians(O_LAT)) + (n - O_N) / K
    sigma = m / g * math.pi / 180
    lat1 = (sigma + (3 * n1 / 2 - 27 * n3 / 32) * math.sin(2 * sigma) + (21 * n2 / 16 - 55 * n4 / 32) * math.sin(4 * sigma)
            + (151 * n3 / 96) * math.sin(6 * sigma) + (1097 * n4 / 512) * math.sin(8 * sigma))
    s = math.sin(lat1)
    rho = A * (1 - E2) / (1 - E2 * s * s) ** 1.5
    v = A / math.sqrt(1 - E2 * s * s)
    psi = v / rho
    t = math.tan(lat1)
    t2, t4, t6 = t * t, t ** 4, t ** 6
    e1 = e - O_E
    x = e1 / (K * v)
    f = t / (K * rho)
    lat = (lat1 - f * (e1 * x / 2)
           + f * (e1 * x ** 3 / 24) * (-4 * psi ** 2 + 9 * psi * (1 - t2) + 12 * t2)
           - f * (e1 * x ** 5 / 720) * (8 * psi ** 4 * (11 - 24 * t2) - 12 * psi ** 3 * (21 - 71 * t2)
                                       + 15 * psi ** 2 * (15 - 98 * t2 + 15 * t4) + 180 * psi * (5 * t2 - 3 * t4) + 360 * t4)
           + f * (e1 * x ** 7 / 40320) * (1385 - 3633 * t2 + 4095 * t4 + 1575 * t6))
    sec = 1 / math.cos(lat1)
    lon = (math.radians(O_LON) + x * sec - (x ** 3 * sec / 6) * (psi + 2 * t2)
           + (x ** 5 * sec / 120) * (-4 * psi ** 3 * (1 - 6 * t2) + psi ** 2 * (9 - 68 * t2) + 72 * psi * t2 + 24 * t4)
           - (x ** 7 * sec / 5040) * (61 + 662 * t2 + 1320 * t4 + 720 * t6))
    return math.degrees(lat), math.degrees(lon)
