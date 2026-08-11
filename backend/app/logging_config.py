import logging
import os
import sys
from datetime import UTC


def setup_logging():
    level = os.getenv("LOG_LEVEL", "INFO").upper()
    fmt_env = os.getenv("LOG_FORMAT", "text")

    if fmt_env == "json":
        import json
        from datetime import datetime

        class JsonFormatter(logging.Formatter):
            def format(self, record):
                log_entry = {
                    "ts": datetime.now(UTC).isoformat(),
                    "lvl": record.levelname,
                    "logger": record.name,
                    "msg": record.getMessage(),
                }
                if record.exc_info and record.exc_info[1]:
                    log_entry["exc"] = self.formatException(record.exc_info)
                return json.dumps(log_entry, default=str, ensure_ascii=False)

        handler = logging.StreamHandler(sys.stderr)
        handler.setFormatter(JsonFormatter())
    else:
        handler = logging.StreamHandler(sys.stderr)
        handler.setFormatter(logging.Formatter(
            "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
            datefmt="%Y-%m-%dT%H:%M:%S",
        ))

    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.addHandler(handler)
    root_logger.setLevel(getattr(logging, level, logging.INFO))

    logging.getLogger("uvicorn.access").handlers.clear()
    logging.getLogger("uvicorn.access").addHandler(handler)
    logging.getLogger("uvicorn.error").handlers.clear()
    logging.getLogger("uvicorn.error").addHandler(handler)

    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
