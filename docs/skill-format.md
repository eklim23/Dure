# Skill Format

AegisForge skills are previewable units of capability. v0.1 supports skill manifests only; it does not execute skill code.

## Manifest

Each skill directory contains `manifest.json`:

```json
{
  "name": "security-review-basic",
  "version": "0.1.0",
  "summary": "Basic security review checklist for generated code.",
  "tags": ["security", "review"],
  "permissions": ["read_files"],
  "estimatedSize": 10240,
  "trusted": false,
  "hash": "sha256:placeholder",
  "signature": "unsigned"
}
```

## Fields

- `name`: stable skill id
- `version`: semantic version
- `summary`: short human-readable description
- `tags`: search and routing metadata
- `permissions`: declared capability needs
- `estimatedSize`: approximate bytes to load
- `trusted`: whether the skill is trusted by local policy
- `hash`: placeholder or real content hash
- `signature`: placeholder or real signature metadata

## Registry Behavior

The registry can:

- scan a catalog directory
- load and validate manifests
- return previews before loading
- report permissions and trust status
- compute a SHA-256 manifest hash when no hash is declared

The registry cannot:

- automatically execute untrusted skills
- grant permissions dynamically
- bypass the orchestrator policy

## Future Work

- Signed skill bundles
- Permission prompts
- Isolated loading
- Skill provenance records in the decision log
