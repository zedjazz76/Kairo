# Pydicom regression fixtures

Unmodified files from pydicom **v3.0.1**:

- [CT_small.dcm](https://raw.githubusercontent.com/pydicom/pydicom/v3.0.1/src/pydicom/data/test_files/CT_small.dcm), 39,206 bytes; SHA-256 `3dd31e5cc835b3f2cdd46c9da1982f59251e78518fefa8163d914631c66437d6`.
- [MR_small.dcm](https://raw.githubusercontent.com/pydicom/pydicom/v3.0.1/src/pydicom/data/test_files/MR_small.dcm), 9,830 bytes; SHA-256 `3f27d1c22f1a66e80d7bb7c911e8610fd0bb70325a76746a7adb1c0ddefcf2bb`.

Upstream license is included in `LICENSE`. These are public test datasets, not user uploads. Both contain an empty Accession Number element. Used to exercise the real DICOM file handler with complete Part 10 binary files, including File Meta Information Version's long `OB` header.

Run `node tools/hl7-toolkit/tests/hl7-toolkit/dicom-pydicom.test.mjs` from the repository root.

For the actual browser regression, start the real toolkit launcher, open its session URL in Chrome using a separate local test profile and `--remote-debugging-port=9222`, then run on the same OS as Chrome:

```text
node tools/hl7-toolkit/tests/hl7-toolkit/helpers/dicom-browser-check.mjs http://127.0.0.1:9222 http://127.0.0.1:<launcher-port>/
```

This assigns each fixture to the actual file input through Chrome DevTools, runs the production change handler, and checks rendered DOM values. It does not automate the native OS file dialog. It leaves the DICOM workspace ready for manual selection. It does not print patient or instance identifiers.
