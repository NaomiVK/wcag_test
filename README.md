# WCAG Accessibility Checker

A Streamlit-based web accessibility testing tool that uses pa11y and axe-core to check WCAG 2.1 AA compliance.

## Features

- Real-time accessibility scanning with pa11y + axe-core
- Visual highlighting of violations in rendered HTML
- Color-coded severity levels (errors, warnings, notices)
- Interactive hover tooltips with violation details
- Streamlit web interface for easy testing

## Setup

### Prerequisites

- Python 3.7+
- Node.js 14+
- npm

### Installation

1. Clone this repository:
```bash
git clone <your-repo-url>
cd wcag_test
```

2. Install Node.js dependencies:
```bash
npm install
```

3. Install Python dependencies:
```bash
pip install streamlit
```

### Dependencies

The project uses these main dependencies:

**Node.js packages:**
- pa11y (accessibility testing)
- axe-core (accessibility rules engine)
- playwright (browser automation)
- cheerio (HTML manipulation)

**Python packages:**
- streamlit (web interface)

## Usage

1. Start the Streamlit app:
```bash
streamlit run streamlit_a11y_app.py
```

2. Open your browser to the displayed URL (usually http://localhost:8501)

3. Enter a URL from allowed domains:
   - canada.ca
   - test.canada.ca
   - gc-proto.github.io
   - cra-design.github.io
   - cra-proto.github.io

4. Click "Run Accessibility Check"

5. View results:
   - Summary metrics at the top
   - Rendered page with highlighted violations
   - Detailed issue list below the page

## Color Coding

- **Red**: Errors (WCAG violations)
- **Orange**: Warnings (potential issues)
- **Yellow**: Notices (informational)

## File Structure

- `streamlit_a11y_app.py` - Main Streamlit application
- `streamlit_a11y_checker.js` - Node.js accessibility checker
- `package.json` - Node.js dependencies
- `a11y_audit_playwright.js` - Alternative Playwright implementation
- `a11y_audit.js` - Original audit script

## Troubleshooting

If you encounter issues:

1. Make sure all dependencies are installed
2. Check that Node.js and Python are in your PATH
3. Ensure the target URL is from an allowed domain
4. Check browser console for JavaScript errors

## Development

To modify the accessibility checking logic, edit `streamlit_a11y_checker.js`.
To modify the UI, edit `streamlit_a11y_app.py`.

The tool is configured for Canadian government websites but can be modified to work with other domains by updating the `allowedHosts` list in the Node.js script.