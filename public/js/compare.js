/* JSON Compare – Monaco diff editor */

let diffEditor = null;
let leftEditor = null;
let rightEditor = null;
let leftDecos = [];
let rightDecos = [];
let originalModel = null;
let modifiedModel = null;

let savedLeft = "";
let savedRight = "";
let isSorted = false;
let isFormatted = false;

const MOBILE_QUERY = window.matchMedia("(max-width: 767px)");

/* ---------- Monaco setup ---------- */

require.config({
    paths: {
        vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min/vs"
    }
});

require(["vs/editor/editor.main"], function () {

    originalModel = monaco.editor.createModel("", "json");
    modifiedModel = monaco.editor.createModel("", "json");

    diffEditor = monaco.editor.createDiffEditor(
        document.getElementById("container"),
        {
            theme: "vs",
            automaticLayout: true,
            renderSideBySide: true,
            // keep both panes editable, even on narrow screens
            useInlineViewWhenSpaceIsLimited: false,
            originalEditable: true,
            readOnly: false,
            ignoreTrimWhitespace: false,
            renderOverviewRuler: false,
            minimap: { enabled: false },
            wordWrap: "on",
            wrappingIndent: "same",
            scrollBeyondLastLine: false
        }
    );

    diffEditor.setModel({ original: originalModel, modified: modifiedModel });

    // Mobile layout: two normal editors stacked, sharing the same models
    const stackedOpts = {
        theme: "vs",
        automaticLayout: true,
        minimap: { enabled: false },
        wordWrap: "on",
        wrappingIndent: "same",
        scrollBeyondLastLine: false,
        glyphMargin: false,
        folding: false,
        renderLineHighlight: "none"
    };

    leftEditor = monaco.editor.create(
        document.getElementById("leftEditor"),
        { ...stackedOpts, model: originalModel }
    );

    rightEditor = monaco.editor.create(
        document.getElementById("rightEditor"),
        { ...stackedOpts, model: modifiedModel }
    );

    // paste karta j valid JSON hoy to auto pretty-format
    function autoFormatOnPaste(ed, model) {
        ed.onDidPaste(() => {
            setTimeout(() => {
                try {
                    const v = JSON.parse(model.getValue());
                    model.setValue(JSON.stringify(v, null, 2));
                } catch (e) { /* invalid hoy to jem chhe tem */ }
            }, 0);
        });
    }

    autoFormatOnPaste(leftEditor, originalModel);
    autoFormatOnPaste(rightEditor, modifiedModel);
    autoFormatOnPaste(diffEditor.getOriginalEditor(), originalModel);
    autoFormatOnPaste(diffEditor.getModifiedEditor(), modifiedModel);

    // Reuse the diff computed by the (hidden on mobile) diff editor
    diffEditor.onDidUpdateDiff(updateStackedDecorations);

    applyResponsiveOptions();
    MOBILE_QUERY.addEventListener("change", applyResponsiveOptions);
});

function applyResponsiveOptions() {

    if (!diffEditor) return;
    const list = document.getElementById("diffList");
    if (list && MOBILE_QUERY.matches) list.classList.remove("hidden");

    const m = MOBILE_QUERY.matches;

    const opts = {
        fontSize: m ? 12 : 14,
        lineNumbers: m ? "off" : "on",
        glyphMargin: !m,
        folding: !m,
        lineDecorationsWidth: m ? 4 : 10,
        lineNumbersMinChars: m ? 2 : 4,
        wordWrap: "on"
    };

    diffEditor.updateOptions(opts);
    diffEditor.getOriginalEditor().updateOptions(opts);
    diffEditor.getModifiedEditor().updateOptions(opts);

    const stacked = {
        fontSize: 12,
        lineNumbers: "on",
        lineDecorationsWidth: 6,
        lineNumbersMinChars: 3
    };

    if (leftEditor) leftEditor.updateOptions(stacked);
    if (rightEditor) rightEditor.updateOptions(stacked);
}

function updateStackedDecorations() {

    if (!leftEditor || !rightEditor) return;

    const changes = diffEditor.getLineChanges() || [];
    const left = [];
    const right = [];

    changes.forEach(c => {

        const hasOrig = c.originalEndLineNumber > 0;
        const hasMod = c.modifiedEndLineNumber > 0;
        const both = hasOrig && hasMod;

        if (hasOrig) {
            left.push({
                range: new monaco.Range(
                    c.originalStartLineNumber,
                    1,
                    c.originalEndLineNumber,
                    1
                ),
                options: {
                    isWholeLine: true,
                    className: "diff-removed"
                }
            });
        }

        if (hasMod) {
            right.push({
                range: new monaco.Range(
                    c.modifiedStartLineNumber,
                    1,
                    c.modifiedEndLineNumber,
                    1
                ),
                options: {
                    isWholeLine: true,
                    className: "diff-added"
                }
            });
        }
        // exact words/characters je alag chhe
        (c.charChanges || []).forEach(ch => {
            if (ch.originalEndColumn > ch.originalStartColumn || ch.originalEndLineNumber > ch.originalStartLineNumber) {
                left.push({
                    range: new monaco.Range(ch.originalStartLineNumber, ch.originalStartColumn,
                        ch.originalEndLineNumber, ch.originalEndColumn),
                    options: { inlineClassName: both ? "diff-char-changed" : "diff-char-removed" }
                });
            }
            if (ch.modifiedEndColumn > ch.modifiedStartColumn || ch.modifiedEndLineNumber > ch.modifiedStartLineNumber) {
                right.push({
                    range: new monaco.Range(ch.modifiedStartLineNumber, ch.modifiedStartColumn,
                        ch.modifiedEndLineNumber, ch.modifiedEndColumn),
                    options: { inlineClassName: both ? "diff-char-changed" : "diff-char-added" }
                });
            }
        });
    });

    leftDecos = leftEditor.deltaDecorations(leftDecos, left);
    rightDecos = rightEditor.deltaDecorations(rightDecos, right);

    updateSummary();
}
/* ---------- Helpers ---------- */

function ready() {
    if (!originalModel || !modifiedModel) {
        alert("Editor is still loading, try again in a moment.");
        return false;
    }
    return true;
}

function indentSize() {
    return isFormatted ? 2 : 0;
}

function sortObject(obj) {

    if (Array.isArray(obj)) return obj.map(sortObject);

    if (obj !== null && typeof obj === "object") {
        return Object.keys(obj).sort().reduce((res, key) => {
            res[key] = sortObject(obj[key]);
            return res;
        }, {});
    }

    return obj;
}

/* Parse both sides; empty side stays empty. Throws with side name on error. */
function parseSide(model, label) {

    const text = model.getValue().trim();
    if (text === "") return undefined;

    try {
        return JSON.parse(text);
    } catch (e) {
        throw new Error(label + " JSON is invalid\n\n" + e.message);
    }
}

function stringify(value, sort, indent) {
    if (value === undefined) return "";
    return JSON.stringify(sort ? sortObject(value) : value, null, indent);
}

/* Re-render both sides with given sort/indent settings */
function render(sort, indent) {

    const left = parseSide(originalModel, "Left");
    const right = parseSide(modifiedModel, "Right");

    originalModel.setValue(stringify(left, sort, indent));
    modifiedModel.setValue(stringify(right, sort, indent));
}

function setButton(id, html, addClasses, removeClasses) {

    const btn = document.getElementById(id);
    if (!btn) return;

    btn.innerHTML = html;
    btn.classList.remove(...removeClasses);
    btn.classList.add(...addClasses);
}

/* ---------- Buttons ---------- */

function toggleFormat() {

    if (!ready()) return;

    try {

        const next = !isFormatted;

        render(isSorted, next ? 2 : 0);
        isFormatted = next;

        if (isFormatted) {
            setButton("formatBtn", "📦 Minify",
                ["bg-orange-500", "hover:bg-orange-600"],
                ["bg-indigo-600", "hover:bg-indigo-700"]);
        } else {
            setButton("formatBtn", "✨ Format",
                ["bg-indigo-600", "hover:bg-indigo-700"],
                ["bg-orange-500", "hover:bg-orange-600"]);
        }

    } catch (e) {
        alert(e.message);
    }
}

function toggleSort() {

    if (!ready()) return;

    try {

        if (!isSorted) {

            // validate first, so nothing is overwritten on error
            const left = parseSide(originalModel, "Left");
            const right = parseSide(modifiedModel, "Right");

            savedLeft = originalModel.getValue();
            savedRight = modifiedModel.getValue();

            originalModel.setValue(stringify(left, true, indentSize()));
            modifiedModel.setValue(stringify(right, true, indentSize()));

            isSorted = true;

            setButton("sortBtn", "↩ Unsort",
                ["bg-rose-500", "hover:bg-rose-600"],
                ["bg-amber-500", "hover:bg-amber-600"]);

        } else {

            originalModel.setValue(savedLeft);
            modifiedModel.setValue(savedRight);

            // restored text has its own original formatting
            isFormatted = false;
            isSorted = false;

            setButton("sortBtn", "🔤 Sort",
                ["bg-amber-500", "hover:bg-amber-600"],
                ["bg-rose-500", "hover:bg-rose-600"]);

            setButton("formatBtn", "✨ Format",
                ["bg-indigo-600", "hover:bg-indigo-700"],
                ["bg-orange-500", "hover:bg-orange-600"]);
        }

    } catch (e) {
        alert(e.message);
    }
}

async function copyCompare() {

    if (!ready()) return;

    const text = modifiedModel.getValue();

    try {
        await navigator.clipboard.writeText(text);
    } catch (e) {
        // fallback for non-secure contexts / older mobile browsers
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
    }

    alert("Copied!");
}

function clearCompare() {

    if (!ready()) return;

    originalModel.setValue("");
    modifiedModel.setValue("");

    savedLeft = "";
    savedRight = "";

    if (isSorted) {
        isSorted = false;
        setButton("sortBtn", "🔤 Sort",
            ["bg-amber-500", "hover:bg-amber-600"],
            ["bg-rose-500", "hover:bg-rose-600"]);
    }

    if (isFormatted) {
        isFormatted = false;
        setButton("formatBtn", "✨ Format",
            ["bg-indigo-600", "hover:bg-indigo-700"],
            ["bg-orange-500", "hover:bg-orange-600"]);
    }
}

/* ---------- Semantic JSON diff (key path wise) ---------- */

function jsonDiff(a, b, path, out) {

    if (a === undefined && b === undefined) return;

    if (a === undefined) { out.push({ type: "added", path, right: b }); return; }
    if (b === undefined) { out.push({ type: "removed", path, left: a }); return; }

    const primitive =
        a === null || b === null ||
        typeof a !== "object" || typeof b !== "object" ||
        Array.isArray(a) !== Array.isArray(b);

    if (primitive) {
        if (JSON.stringify(a) !== JSON.stringify(b)) {
            out.push({ type: "changed", path, left: a, right: b });
        }
        return;
    }

    if (Array.isArray(a)) {
        const len = Math.max(a.length, b.length);
        for (let i = 0; i < len; i++) {
            jsonDiff(a[i], b[i], path + "[" + i + "]", out);
        }
        return;
    }

    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    keys.forEach(k => {
        jsonDiff(a[k], b[k], path ? path + "." + k : k, out);
    });
}

function short(v) {
    if (v === undefined) return "";
    const s = JSON.stringify(v);
    return s.length > 60 ? s.slice(0, 60) + "…" : s;
}

function esc(s) {
    return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function updateSummary() {

    const badge = document.getElementById("diffBadge");
    const list = document.getElementById("diffList");
    if (!badge || !list || !originalModel) return;

    const lt = originalModel.getValue().trim();
    const rt = modifiedModel.getValue().trim();

    if (!lt && !rt) {
        badge.textContent = "Both sides ma JSON paste karo";
        badge.className = "px-2 py-1 rounded-md bg-slate-100 text-slate-600";
        list.innerHTML = "";
        return;
    }

    let a, b;
    try {
        a = lt ? JSON.parse(lt) : undefined;
        b = rt ? JSON.parse(rt) : undefined;
    } catch (e) {
        badge.textContent = "⚠ Invalid JSON (line-wise diff j dekhase)";
        badge.className = "px-2 py-1 rounded-md bg-red-100 text-red-700";
        list.innerHTML = "";
        return;
    }

    const diffs = [];
    jsonDiff(a, b, "", diffs);

    if (diffs.length === 0) {
        badge.textContent = "✅ Both JSON same chhe";
        badge.className = "px-2 py-1 rounded-md bg-emerald-100 text-emerald-700";
        list.innerHTML = "";
        return;
    }

    const n = t => diffs.filter(d => d.type === t).length;
    badge.textContent = `${diffs.length} differences · ${n("changed")} changed · ${n("added")} added · ${n("removed")} removed`;
    badge.className = "px-2 py-1 rounded-md bg-amber-100 text-amber-800";

    list.innerHTML = diffs.map(d => `
        <div class="px-3 py-2 flex flex-wrap items-center gap-2">
            <span class="text-xs font-semibold px-2 py-0.5 rounded tag-${d.type}">${d.type}</span>
            <code class="font-semibold">${esc(d.path || "(root)")}</code>
            ${d.type !== "added" ? `<span class="text-red-600">${esc(short(d.left))}</span>` : ""}
            ${d.type === "changed" ? "→" : ""}
            ${d.type !== "removed" ? `<span class="text-green-700">${esc(short(d.right))}</span>` : ""}
        </div>`).join("");
}

function toggleDiffList() {
    document.getElementById("diffList").classList.toggle("hidden");
}

function gotoDiff(dir) {
    if (!diffEditor) return;
    diffEditor.goToDiff(dir);   // desktop diff editor ma next/previous farak par jaay
}