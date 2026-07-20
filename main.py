#!/usr/bin/env python3
"""CLI entry point for ingest and multimodal RAG queries."""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("multimodal-rag")


async def _run_ingest(path: str | None) -> int:
    from src.agent.tools import ingest_documents_tool

    result = await ingest_documents_tool(path=path)
    print(json.dumps(result, indent=2))
    return 0 if result.get("status") in {"ok", "empty"} else 1


async def _run_query(query: str) -> int:
    from src.agent.tools import query_documents_tool

    result = await query_documents_tool(query=query)
    print(result.answer)
    if result.text_sources or result.image_sources:
        print("\n--- sources ---")
        print(
            json.dumps(
                {
                    "text_sources": result.text_sources,
                    "image_sources": result.image_sources,
                },
                indent=2,
            )
        )
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Multimodal RAG Agent — LlamaIndex + LlamaParse + Gemini VLM",
    )
    sub = parser.add_subparsers(dest="command")

    ingest = sub.add_parser("ingest", help="Parse and index documents")
    ingest.add_argument(
        "--path",
        default=None,
        help="File or directory (default: data/raw_documents/)",
    )

    query = sub.add_parser("query", help="Ask a multimodal question")
    query.add_argument("--query", "-q", required=True, help="Natural language question")

    # Backward-compatible top-level --query (as in AGENT.md quickstart)
    parser.add_argument(
        "--query",
        dest="legacy_query",
        default=None,
        help="Shortcut: run a query without subcommand",
    )
    parser.add_argument(
        "--serve",
        action="store_true",
        help="Start the FastAPI server (uvicorn)",
    )
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8000)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.serve:
        import uvicorn

        uvicorn.run("src.main:app", host=args.host, port=args.port, reload=False)
        return 0

    if args.legacy_query:
        return asyncio.run(_run_query(args.legacy_query))

    if args.command == "ingest":
        return asyncio.run(_run_ingest(args.path))
    if args.command == "query":
        return asyncio.run(_run_query(args.query))

    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
