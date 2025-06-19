// a11y_audit.js
const puppeteer = require('puppeteer');
const fs = require('fs');
const axeSource = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

// Args: node a11y_audit.js <URL> <WCAG_LEVELS> <DEVICE_TYPE> <OUTPUT_PATH> <KEYBOARD_TESTING>
const [,, url, wcagLevels, deviceType, outputPath, keyboardTesting] = process.argv;
const levels = wcagLevels.split(',');
const enableKeyboardTesting = keyboardTesting === 'true';

const mobileEmulation = {
  name: 'iPhone X',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_3 like Mac OS X)',
  viewport: {
    width: 375,
    height: 812,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    isLandscape: false
  }
};

(async () => {
  const browser = await puppeteer.launch({
    args: [
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-site-isolation-trials',
      '--allow-running-insecure-content'
    ]
  });
  const page = await browser.newPage();
  
  // Enable all permissions for better resource loading
  await page.setDefaultNavigationTimeout(60000);
  await page.setBypassCSP(true);
  
  // Intercept and allow all requests
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    request.continue();
  });

  if (deviceType === "mobile") {
    await page.emulate(mobileEmulation);
  }

  // Navigate and wait for all resources to load
  await page.goto(url, {
    waitUntil: ['networkidle0', 'domcontentloaded', 'load'],
    timeout: 60000
  });
  
  // Wait for initial page load
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Fetch and inline all external stylesheets
  await page.evaluate(async () => {
    // Find all link elements with rel="stylesheet"
    const linkElements = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
    
    console.log(`Found ${linkElements.length} stylesheet links to inline`);
    
    // Fetch each stylesheet and inline it
    for (const link of linkElements) {
      try {
        const href = link.href;
        if (href && !href.startsWith('data:')) {
          console.log('Fetching stylesheet:', href);
          
          const response = await fetch(href);
          if (response.ok) {
            const cssText = await response.text();
            
            // Create a new style element
            const style = document.createElement('style');
            style.textContent = cssText;
            style.setAttribute('data-inlined-from', href);
            
            // Insert the style element right after the link element
            link.parentNode.insertBefore(style, link.nextSibling);
            
            console.log('Successfully inlined stylesheet:', href);
          } else {
            console.log('Failed to fetch stylesheet:', href, response.status);
          }
        }
      } catch (error) {
        console.log('Error fetching stylesheet:', link.href, error);
      }
    }
    
    // Wait for fonts to load if available
    try {
      await document.fonts.ready;
    } catch (e) {
      console.log('Fonts not ready:', e);
    }
  });
  
  // Additional wait for dynamic content and CSS application
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  await page.evaluate(axeSource); // Inject axe-core
  
  // Give axe-core time to initialize
  await new Promise(resolve => setTimeout(resolve, 1000));

  const results = await page.evaluate(async (levels) => {
    return await axe.run(document, {
      runOnly: {
        type: 'tag',
        values: levels
      },
      exclude: [
        // Exclude Canada.ca header elements that commonly have issues
        'header[role="banner"]',
        '.wb-header',
        '#wb-bnr',
        '.gc-bar',
        '.fip',
        '.brand',
        '.search',
        '#wb-srch',
        '.wb-srch',
        '[class*="header"]',
        '[id*="header"]',
        '[class*="banner"]',
        '[id*="banner"]',
        // Additional Canada.ca specific selectors
        '.container.gc-bar',
        '.gc-bar .container',
        '.wb-bar',
        '.wb-bar-top',
        '.wb-bar-bottom',
        'nav[role="navigation"]',
        '.wb-navcurr',
        '.wb-menu',
        '.wb-sm',
        '.wb-sl',
        '.gcweb-menu',
        '.gcweb-search',
        '.gcweb-lang-toggle',
        '.gc-main-menu',
        '.gc-sub-menu',
        // Skip links and language toggle
        '.wb-slc',
        '.wb-lng',
        // Top navigation elements
        'header',
        'nav'
      ]
    });
  }, levels);

  // Enhanced highlighting with tooltips and color coding
  await page.evaluate(() => {
    // Add tooltip styles with different colors for different issue types
    const style = document.createElement('style');
    style.textContent = `
      /* WCAG 2.0 A and AA violations - RED */
      .a11y-violation-wcag {
        position: relative !important;
        outline: 3px solid #ff4444 !important;
        outline-offset: 2px !important;
        box-shadow: 0 0 10px rgba(255, 68, 68, 0.5) !important;
      }
      
      /* Best Practice violations - ORANGE */
      .a11y-violation-best-practice {
        position: relative !important;
        outline: 3px solid #ff8800 !important;
        outline-offset: 2px !important;
        box-shadow: 0 0 10px rgba(255, 136, 0, 0.5) !important;
      }
      
      /* ARIA violations - YELLOW */
      .a11y-violation-aria {
        position: relative !important;
        outline: 3px solid #ffdd00 !important;
        outline-offset: 2px !important;
        box-shadow: 0 0 10px rgba(255, 221, 0, 0.5) !important;
      }
      
      .a11y-tooltip {
        position: absolute !important;
        background: #333 !important;
        color: white !important;
        padding: 8px 12px !important;
        border-radius: 4px !important;
        font-size: 12px !important;
        line-height: 1.4 !important;
        max-width: 300px !important;
        z-index: 9999 !important;
        display: none !important;
        box-shadow: 0 4px 8px rgba(0,0,0,0.3) !important;
        font-family: Arial, sans-serif !important;
      }
      
      .a11y-violation-wcag:hover .a11y-tooltip,
      .a11y-violation-best-practice:hover .a11y-tooltip,
      .a11y-violation-aria:hover .a11y-tooltip {
        display: block !important;
      }
      
      .a11y-violation-count {
        position: fixed !important;
        top: 10px !important;
        right: 10px !important;
        background: #333 !important;
        color: white !important;
        padding: 10px 15px !important;
        border-radius: 5px !important;
        font-weight: bold !important;
        z-index: 10000 !important;
        font-family: Arial, sans-serif !important;
        font-size: 14px !important;
      }
    `;
    document.head.appendChild(style);
  });

  let violationCounts = {
    wcag: 0,
    bestPractice: 0,
    aria: 0
  };
  
  for (const violation of results.violations) {
    for (const node of violation.nodes) {
      for (const selector of node.target) {
        await page.evaluate((selector, violation, impact, tags) => {
          try {
            const el = document.querySelector(selector);
            if (el) {
              // Determine violation type based on tags
              let violationType = 'wcag'; // default
              let violationClass = 'a11y-violation-wcag';
              
              if (tags.includes('best-practice')) {
                violationType = 'best-practice';
                violationClass = 'a11y-violation-best-practice';
              } else if (tags.some(tag => tag.startsWith('wcag2a') || tag.startsWith('wcag2aa'))) {
                violationType = 'wcag';
                violationClass = 'a11y-violation-wcag';
              } else if (tags.some(tag => tag.includes('aria'))) {
                violationType = 'aria';
                violationClass = 'a11y-violation-aria';
              }
              
              el.classList.add(violationClass);
              
              const tooltip = document.createElement('div');
              tooltip.className = 'a11y-tooltip';
              tooltip.innerHTML = `
                <strong>${violation.id}</strong><br>
                <strong>Impact:</strong> ${impact}<br>
                <strong>Type:</strong> ${violationType.toUpperCase()}<br>
                <strong>Tags:</strong> ${tags.join(', ')}<br>
                <strong>Description:</strong> ${violation.description}<br>
                <strong>Help:</strong> ${violation.helpUrl ? '<a href="' + violation.helpUrl + '" target="_blank" style="color: #66ccff;">Learn more</a>' : 'N/A'}
              `;
              
              el.style.position = el.style.position || 'relative';
              el.appendChild(tooltip);
              
              return violationType;
            }
          } catch (e) {
            console.warn('Could not highlight element:', selector, e);
          }
          return null;
        }, selector, violation, violation.impact, violation.tags).then(violationType => {
          if (violationType === 'wcag') violationCounts.wcag++;
          else if (violationType === 'best-practice') violationCounts.bestPractice++;
          else if (violationType === 'aria') violationCounts.aria++;
        });
      }
    }
  }

  // Perform keyboard navigation testing if enabled
  let tabOrder = {
    focusableCount: 0,
    unreachableCount: 0
  };

  if (enableKeyboardTesting) {
    console.log('Starting keyboard navigation testing...');
    
    await page.evaluate(() => {
      // Add keyboard navigation styles
      const keyboardStyle = document.createElement('style');
      keyboardStyle.id = 'keyboard-nav-styles';
      keyboardStyle.textContent = `
        .keyboard-focusable {
          position: relative !important;
        }
        .keyboard-tab-order {
          position: absolute !important;
          top: -10px !important;
          left: -10px !important;
          background: #0066cc !important;
          color: white !important;
          padding: 2px 6px !important;
          border-radius: 3px !important;
          font-size: 12px !important;
          font-weight: bold !important;
          z-index: 10001 !important;
          font-family: Arial, sans-serif !important;
          border: 2px solid #004499 !important;
        }
        .keyboard-current-focus {
          outline: 4px solid #0066cc !important;
          outline-offset: 2px !important;
          box-shadow: 0 0 15px rgba(0, 102, 204, 0.7) !important;
        }
        .keyboard-unreachable {
          outline: 4px solid #cc0000 !important;
          outline-offset: 2px !important;
          box-shadow: 0 0 15px rgba(204, 0, 0, 0.7) !important;
        }
      `;
      document.head.appendChild(keyboardStyle);
    });

    // Simulate keyboard navigation and collect tab order
    tabOrder = await page.evaluate(async () => {
      const focusableElements = [];
      const unreachableElements = [];
      let tabIndex = 1;
      
      // Get all potentially focusable elements
      const potentiallyFocusable = document.querySelectorAll(
        'a[href], button, input, textarea, select, details, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]'
      );
      
      // Test each element for focusability
      for (const element of potentiallyFocusable) {
        try {
          // Skip if element is hidden or disabled
          const style = window.getComputedStyle(element);
          if (style.display === 'none' || style.visibility === 'hidden' || element.disabled) {
            continue;
          }
          
          // Try to focus the element
          element.focus();
          
          if (document.activeElement === element) {
            // Element is focusable
            element.classList.add('keyboard-focusable');
            
            // Add tab order indicator
            const tabIndicator = document.createElement('div');
            tabIndicator.className = 'keyboard-tab-order';
            tabIndicator.textContent = tabIndex;
            element.style.position = element.style.position || 'relative';
            element.appendChild(tabIndicator);
            
            focusableElements.push({
              tagName: element.tagName,
              id: element.id || '',
              className: element.className || '',
              text: element.textContent?.substring(0, 50) || '',
              tabIndex: tabIndex,
              hasVisibleFocus: style.outline !== 'none' || style.outlineWidth !== '0px'
            });
            
            tabIndex++;
          } else {
            // Element should be focusable but isn't
            if (element.tagName === 'A' || element.tagName === 'BUTTON' || element.tagName === 'INPUT') {
              element.classList.add('keyboard-unreachable');
              unreachableElements.push({
                tagName: element.tagName,
                id: element.id || '',
                className: element.className || '',
                text: element.textContent?.substring(0, 50) || ''
              });
            }
          }
        } catch (e) {
          // Element caused an error when trying to focus
          console.warn('Error focusing element:', element, e);
        }
      }
      
      // Remove focus from last element
      if (document.activeElement) {
        document.activeElement.blur();
      }
      
      return {
        focusableCount: focusableElements.length,
        unreachableCount: unreachableElements.length,
        focusableElements: focusableElements,
        unreachableElements: unreachableElements
      };
    });

    console.log(`Keyboard navigation test complete: ${tabOrder.focusableCount} focusable elements, ${tabOrder.unreachableCount} unreachable elements`);
  }

  // Add violation count badge with breakdown by type and keyboard info if enabled
  await page.evaluate((counts, keyboardInfo, keyboardEnabled) => {
    const totalCount = counts.wcag + counts.bestPractice + counts.aria;
    const badge = document.createElement('div');
    badge.className = 'a11y-violation-count';
    
    let badgeText = `${totalCount} Accessibility Issues Found`;
    if (totalCount > 0) {
      const breakdown = [];
      if (counts.wcag > 0) breakdown.push(`🔴 ${counts.wcag} WCAG`);
      if (counts.bestPractice > 0) breakdown.push(`🟠 ${counts.bestPractice} Best Practice`);
      if (counts.aria > 0) breakdown.push(`🟡 ${counts.aria} ARIA`);
      
      badgeText += `<br><small>${breakdown.join(' | ')}</small>`;
    }
    
    // Add keyboard navigation info if enabled
    if (keyboardEnabled) {
      badgeText += `<br><small>⌨️ ${keyboardInfo.focusableCount} Focusable Elements`;
      if (keyboardInfo.unreachableCount > 0) {
        badgeText += ` | 🚫 ${keyboardInfo.unreachableCount} Unreachable`;
      }
      badgeText += `</small>`;
    }
    
    badge.innerHTML = badgeText;
    document.body.appendChild(badge);
  }, violationCounts, tabOrder, enableKeyboardTesting);

  // Get the final HTML with inlined stylesheets
  const selfContainedHtml = await page.evaluate((originalUrl) => {
    // Get the document HTML
    let html = document.documentElement.outerHTML;
    
    // Add base tag for relative URLs
    const baseUrl = originalUrl.split('/').slice(0, 3).join('/');
    const baseTag = `<base href="${baseUrl}/">`;
    html = html.replace('<head>', `<head>${baseTag}`);
    
    // Add accessibility highlighting styles
    const accessibilityStyles = `
    <style type="text/css">
      /* WCAG 2.0 A and AA violations - RED */
      .a11y-violation-wcag {
        position: relative !important;
        outline: 3px solid #ff4444 !important;
        outline-offset: 2px !important;
        box-shadow: 0 0 10px rgba(255, 68, 68, 0.5) !important;
      }
      
      /* Best Practice violations - ORANGE */
      .a11y-violation-best-practice {
        position: relative !important;
        outline: 3px solid #ff8800 !important;
        outline-offset: 2px !important;
        box-shadow: 0 0 10px rgba(255, 136, 0, 0.5) !important;
      }
      
      /* ARIA violations - YELLOW */
      .a11y-violation-aria {
        position: relative !important;
        outline: 3px solid #ffdd00 !important;
        outline-offset: 2px !important;
        box-shadow: 0 0 10px rgba(255, 221, 0, 0.5) !important;
      }
      
      .a11y-tooltip {
        position: absolute !important;
        background: #333 !important;
        color: white !important;
        padding: 8px 12px !important;
        border-radius: 4px !important;
        font-size: 12px !important;
        line-height: 1.4 !important;
        max-width: 300px !important;
        z-index: 9999 !important;
        display: none !important;
        box-shadow: 0 4px 8px rgba(0,0,0,0.3) !important;
        font-family: Arial, sans-serif !important;
      }
      
      .a11y-violation-wcag:hover .a11y-tooltip,
      .a11y-violation-best-practice:hover .a11y-tooltip,
      .a11y-violation-aria:hover .a11y-tooltip {
        display: block !important;
      }
      
      .a11y-violation-count {
        position: fixed !important;
        top: 10px !important;
        right: 10px !important;
        background: #333 !important;
        color: white !important;
        padding: 10px 15px !important;
        border-radius: 5px !important;
        font-weight: bold !important;
        z-index: 10000 !important;
        font-family: Arial, sans-serif !important;
        font-size: 14px !important;
      }
      
      /* Keyboard Navigation Styles */
      .keyboard-focusable {
        position: relative !important;
      }
      .keyboard-tab-order {
        position: absolute !important;
        top: -10px !important;
        left: -10px !important;
        background: #0066cc !important;
        color: white !important;
        padding: 2px 6px !important;
        border-radius: 3px !important;
        font-size: 12px !important;
        font-weight: bold !important;
        z-index: 10001 !important;
        font-family: Arial, sans-serif !important;
        border: 2px solid #004499 !important;
      }
      .keyboard-current-focus {
        outline: 4px solid #0066cc !important;
        outline-offset: 2px !important;
        box-shadow: 0 0 15px rgba(0, 102, 204, 0.7) !important;
      }
      .keyboard-unreachable {
        outline: 4px solid #cc0000 !important;
        outline-offset: 2px !important;
        box-shadow: 0 0 15px rgba(204, 0, 0, 0.7) !important;
      }
    </style>`;
    
    html = html.replace('</head>', `${accessibilityStyles}</head>`);
    
    // Convert remaining relative URLs to absolute
    html = html.replace(/src="(?!https?:\/\/|data:|#)/g, `src="${baseUrl}/`);
    html = html.replace(/href="(?!https?:\/\/|data:|#|mailto:)/g, `href="${baseUrl}/`);
    
    return html;
  }, url);
  
  fs.writeFileSync(outputPath, selfContainedHtml, 'utf8');
  await browser.close();
})();
