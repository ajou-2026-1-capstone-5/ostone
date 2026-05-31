# Category-Free Evaluation Benchmarks

Benchmark files in this directory are offline gold annotations. They must not be used as pipeline input,
representation features, clustering hints, threshold calibration data, or production metadata.

Allowed fields are limited to stable caselet identifiers, turn spans, manually reviewed object/action
expectations, and workflow event expectations. Do not add unavailable metadata such as
`consulting_category`, category labels, or production-only routing hints.

Current samples:

- `validation-activeventure.sample.json`
- `validation-hanacard.sample.json`
- `validation-lguplus.sample.json`
