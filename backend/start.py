import os
import subprocess
import sys

subprocess.run(
    [sys.executable, "manage.py", "migrate", "--noinput"],
    check=True,
)

port = os.environ.get("PORT", "10000")

os.execvp(
    "gunicorn",
    [
        "gunicorn",
        "core.wsgi:application",
        "--bind",
        f"0.0.0.0:{port}",
        "--workers",
        "2",
        "--timeout",
        "120",
    ],
)