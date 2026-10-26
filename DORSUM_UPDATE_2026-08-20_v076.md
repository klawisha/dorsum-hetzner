# Dorsum v0.7.6 — structural tablet finance spine fix

- Finance header/date selector and SpinePullRefresh are now grouped inside `finance-top-controls`.
- Spine is no longer a direct child of `.finance-page`; all accumulated legacy direct-child absolute rules stop matching it.
- 621–1100 px: spine is a normal grid row below the header/date selector, so overlap is structurally impossible.
- 621–820 px: finance header stacks before the spine.
- >1100 px: desktop hanging spine behavior is preserved.
- <=620 px: compact standalone spine remains in normal document flow.
- Removed accidental literal `\n` sequences from admin.css before packaging.
