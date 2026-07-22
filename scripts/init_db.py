from __future__ import annotations

import _bootstrap  # noqa: F401

from pokemon_tcg_tracker.db import connect
from pokemon_tcg_tracker.schema import initialize_schema


def main() -> None:
    with connect() as connection:
        initialize_schema(connection)
    print("Database initialized.")


if __name__ == "__main__":
    main()
