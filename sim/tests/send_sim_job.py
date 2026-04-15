#!/usr/bin/env python3
import argparse
import json
import sys
import urllib.error
import urllib.request


def main() -> int:
    parser = argparse.ArgumentParser(description="Send test job to sim server")
    parser.add_argument(
        "--environment-path",
        default="/usr/src/app/public/jobs/sample_env",
        help="Path visible from sim container",
    )
    parser.add_argument("--model-number", default="1", help="Model number")
    parser.add_argument("--server-url", default="http://localhost:3004", help="Sim server URL")
    args = parser.parse_args()

    payload = {
        "environmentPath": args.environment_path,
        "modelNumber": args.model_number,
    }

    url = f"{args.server_url.rstrip('/')}/sim-jobs"
    data = json.dumps(payload).encode("utf-8")

    request = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    print(f"Sending POST {url}")
    print(f"Payload: {json.dumps(payload)}")

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            body = response.read().decode("utf-8", errors="replace")
            print(f"Status: {response.status}")
            if body:
                try:
                    parsed = json.loads(body)
                    print(json.dumps(parsed, indent=2))
                except json.JSONDecodeError:
                    print(body)
            return 0
    except urllib.error.HTTPError as error:
        error_body = error.read().decode("utf-8", errors="replace")
        print(f"Request failed with status {error.code}", file=sys.stderr)
        if error_body:
            print(error_body, file=sys.stderr)
        return 1
    except urllib.error.URLError as error:
        print(f"Request failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
