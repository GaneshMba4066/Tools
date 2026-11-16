(() => {
  // Helper: Find human-readable label for a form control
  function resolveFieldLabel(el) {
    // 1. Direct label[for="id"]
    if (el.id) {
      try {
        const labelEl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (labelEl && labelEl.innerText.trim()) {
          return cleanLabelText(labelEl.innerText);
        }
      } catch (e) {
        // ignore invalid selector
      }
    }

    // 2. aria-labelledby
    const labelledBy = el.getAttribute("aria-labelledby");
    if (labelledBy) {
      const parts = labelledBy.split(/\s+/).map(id => {
        const target = document.getElementById(id);
        return target ? target.innerText.trim() : "";
      }).filter(Boolean);
      if (parts.length > 0) return cleanLabelText(parts.join(" "));
    }

    // 3. aria-label
    const ariaLabel = el.getAttribute("aria-label");
    if (ariaLabel && ariaLabel.trim()) {
      return cleanLabelText(ariaLabel);
    }

    // 4. Closest parent <label>
    const parentLabel = el.closest("label");
    if (parentLabel && parentLabel.innerText.trim()) {
      return cleanLabelText(parentLabel.innerText);
    }

    // 5. Workday / Greenhouse / Lever custom container labels
    const formGroup = el.closest('[data-automation-id*="formField"], .field, .form-group, .application-question, .jobs-easy-apply-form-section__grouping');
    if (formGroup) {
      const heading = formGroup.querySelector('label, [data-automation-id="formLabel"], legend, .css-1b4w208, .application-label, h3, h4');
      if (heading && heading.innerText.trim()) {
        return cleanLabelText(heading.innerText);
      }
    }

    // 6. Preceding legend in fieldset
    const fieldset = el.closest("fieldset");
    if (fieldset) {
      const legend = fieldset.querySelector("legend");
      if (legend && legend.innerText.trim()) {
        return cleanLabelText(legend.innerText);
      }
    }

    // 7. Sibling text or placeholder fallback
    if (el.placeholder && el.placeholder.trim()) {
      return cleanLabelText(el.placeholder);
    }

    if (el.name && el.name.trim()) {
      return el.name.replace(/[-_]/g, " ").trim();
    }

    return "Unnamed Field";
  }

  function cleanLabelText(str) {
    return str
      .replace(/\s*\*+\s*$/, "") // Remove required asterisks
      .replace(/[\r\n\t]+/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim()
      .substring(0, 160);
  }

  // Check if an element is visible to the candidate
  function isVisible(el) {
    if (!el || el.offsetParent === null) {
      // Check computed style for opacity or display
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
        return false;
      }
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  // Scan document for all interactable fields
  const allElements = Array.from(document.querySelectorAll("input, textarea, select, [contenteditable='true']"));
  const fields = [];
  let fieldIdxCounter = 0;

  // Track processed radio groups by name so they don't produce duplicate field objects
  const processedRadioGroups = new Set();

  allElements.forEach((el) => {
    // Exclude header, nav, footer, search inputs
    if (el.closest("header, nav, footer, [role='navigation'], [role='search']")) return;

    const tagName = el.tagName.toLowerCase();
    const type = (el.getAttribute("type") || "").toLowerCase();

    // Skip submit, buttons, hidden, files (files require manual user pick for security)
    if (["hidden", "submit", "button", "reset", "image", "file"].includes(type)) return;
    if (type === "search") return;

    // Handle Radio Button Groups
    if (type === "radio") {
      const radioName = el.name || `radio_group_${fieldIdxCounter}`;
      if (processedRadioGroups.has(radioName)) return;

      const radiosInGroup = Array.from(document.querySelectorAll(`input[type="radio"][name="${CSS.escape(el.name)}"]`));
      if (radiosInGroup.length === 0) return;

      processedRadioGroups.add(radioName);

      const groupOptions = radiosInGroup.map((r, rIdx) => {
        r.setAttribute("data-gemini-idx", `${fieldIdxCounter}_${rIdx}`);
        let optLabel = "";
        const rLabel = r.closest("label") || document.querySelector(`label[for="${CSS.escape(r.id)}"]`);
        if (rLabel) optLabel = rLabel.innerText.trim();
        return {
          idx: `${fieldIdxCounter}_${rIdx}`,
          value: r.value,
          label: optLabel || r.value || `Option ${rIdx + 1}`
        };
      });

      // Find question label for the group
      let groupLabel = resolveFieldLabel(el);
      const fieldset = el.closest("fieldset");
      if (fieldset) {
        const legend = fieldset.querySelector("legend");
        if (legend && legend.innerText.trim()) groupLabel = cleanLabelText(legend.innerText);
      }

      fields.push({
        fieldIndex: fieldIdxCounter,
        tag: "radio-group",
        type: "radio",
        label: groupLabel,
        options: groupOptions.map(o => o.label)
      });

      fieldIdxCounter++;
      return;
    }

    // Handle standard inputs, textareas, selects
    if (!isVisible(el)) return;

    el.setAttribute("data-gemini-idx", fieldIdxCounter.toString());

    const label = resolveFieldLabel(el);
    const fieldData = {
      fieldIndex: fieldIdxCounter,
      tag: tagName,
      type: type || (tagName === "textarea" ? "textarea" : "text"),
      name: el.name || "",
      placeholder: el.placeholder || "",
      label: label
    };

    if (tagName === "select") {
      fieldData.options = Array.from(el.options)
        .map(o => o.text.trim())
        .filter(t => t.length > 0 && !t.toLowerCase().includes("select"))
        .slice(0, 30);
    }

    fields.push(fieldData);
    fieldIdxCounter++;
  });

  // Extract relevant page text for context (Job Description & Requirements)
  let contextText = "";
  const jdContainer = document.querySelector('[data-automation-id="jobPostingDescription"], .job-description, #job-description, .description, [class*="description"], [role="main"]');
  if (jdContainer) {
    contextText = jdContainer.innerText.substring(0, 4000);
  } else {
    contextText = document.body.innerText.substring(0, 3500);
  }

  // Global framework-compatible injector
  window.applyGeminiAutofill = (mappings) => {
    let filledCount = 0;

    mappings.forEach(({ id, value }) => {
      if (!value || typeof value !== "string" || value.trim() === "") return;

      const trimmedVal = value.trim();

      // Check if it's a radio group (id matches index)
      const radioElements = Array.from(document.querySelectorAll(`[data-gemini-idx^="${id}_"]`));
      if (radioElements.length > 0) {
        // Find best matching radio
        let targetRadio = radioElements.find(r => {
          const rLabel = r.closest("label")?.innerText || "";
          return rLabel.toLowerCase().includes(trimmedVal.toLowerCase()) || r.value.toLowerCase() === trimmedVal.toLowerCase();
        });

        if (!targetRadio && (trimmedVal.toLowerCase() === "yes" || trimmedVal.toLowerCase() === "true")) {
          targetRadio = radioElements[0];
        }

        if (targetRadio) {
          targetRadio.checked = true;
          targetRadio.dispatchEvent(new Event("click", { bubbles: true }));
          targetRadio.dispatchEvent(new Event("change", { bubbles: true }));
          highlightElement(targetRadio.closest("label") || targetRadio);
          filledCount++;
          return;
        }
      }

      // Check standard element
      const el = document.querySelector(`[data-gemini-idx="${id}"]`);
      if (!el) return;

      const tag = el.tagName.toLowerCase();
      const type = (el.type || "").toLowerCase();

      if (tag === "select") {
        // Match option by text or value
        const options = Array.from(el.options);
        const match = options.find(o => 
          o.text.trim().toLowerCase() === trimmedVal.toLowerCase() ||
          o.value.trim().toLowerCase() === trimmedVal.toLowerCase() ||
          o.text.toLowerCase().includes(trimmedVal.toLowerCase())
        );

        if (match) {
          el.value = match.value;
          el.dispatchEvent(new Event("change", { bubbles: true }));
          highlightElement(el);
          filledCount++;
        }
      } else if (type === "checkbox") {
        const isTrue = ["true", "yes", "1", "agree"].includes(trimmedVal.toLowerCase());
        el.checked = isTrue;
        el.dispatchEvent(new Event("click", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        highlightElement(el);
        filledCount++;
      } else if (el.isContentEditable) {
        el.innerText = trimmedVal;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        highlightElement(el);
        filledCount++;
      } else {
        // React 16+ / Vue / Angular native prototype value setter bypass
        const isTextArea = tag === "textarea";
        const prototype = isTextArea ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
        const nativeSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;

        if (nativeSetter) {
          nativeSetter.call(el, trimmedVal);
        } else {
          el.value = trimmedVal;
        }

        // Reset React's internal value tracker
        if (el._valueTracker) {
          el._valueTracker.setValue("");
        }

        // Fire full event chain for synthetic listeners
        el.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
        el.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
        el.dispatchEvent(new FocusEvent("blur", { bubbles: true }));

        highlightElement(el);
        filledCount++;
      }
    });

    return { filled: filledCount };
  };

  function highlightElement(el) {
    if (!el) return;
    const originalOutline = el.style.outline;
    const originalBoxShadow = el.style.boxShadow;
    el.style.outline = "2px solid #10b981";
    el.style.boxShadow = "0 0 8px rgba(16, 185, 129, 0.4)";
    el.style.transition = "outline 0.3s, box-shadow 0.3s";
    
    // Optional: remove highlight after 8 seconds
    setTimeout(() => {
      el.style.outline = originalOutline;
      el.style.boxShadow = originalBoxShadow;
    }, 8000);
  }

  return {
    pageText: contextText,
    fields: fields
  };
})();

