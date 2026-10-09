let isSorted = false;
let originalJSON = "";
let isMinified = false;

let compareLeftJSON = "";
let compareRightJSON = "";
let compareSide = "left";

function formatJSON() {

    const input = document.getElementById("input").value.trim();
    const output = document.getElementById("output");

    try {

        const parsed = JSON.parse(input);

        const formatted = JSON.stringify(parsed, null, 2);

        // Compare page માટે store
        if (compareSide === "left") {

            compareLeftJSON = formatted;
            compareSide = "right";

        } else {

            compareRightJSON = formatted;
            compareSide = "left";

        }
        originalJSON = formatted;
        isSorted = false;
        isMinified = false;
        document.querySelector("#sortBtn .text-xs").textContent = "Sort";

        output.textContent = formatted;

        hljs.highlightElement(output);
        updateOutput(formatted);



        // Hide button
        document.getElementById("formatBtn").classList.add("hidden");
        document.getElementById("minifyBtn").classList.remove("hidden");

        // Compare page ખુલ્લું હોય તો તરત update કરો
        const leftBox = document.getElementById("leftJson");
        const rightBox = document.getElementById("rightJson");

        if (leftBox && rightBox) {

            leftBox.value = compareLeftJSON;
            rightBox.value = compareRightJSON;

            if (compareLeftJSON && compareRightJSON) {
                compareJSON();
            }

        }

    } catch (error) {

        alert(getJSONErrorMessage(error));

    }

}

function showCompare() {
    window.location.href = "compare.html";
}

function minifyJSON() {

    const input = document.getElementById("input").value.trim();
    const output = document.getElementById("output");

    if (!input) {
        alert("⚠️ Please paste some JSON first.");
        return;
    }

    try {

        const parsed = JSON.parse(input);

        // માત્ર output માં Minified JSON
        const minified = JSON.stringify(parsed);

        updateOutput(minified);

        originalJSON = minified;
        isMinified = true;
        isSorted = false;

        document.querySelector("#sortBtn .text-xs").textContent = "Sort";

        // Buttons બદલાવ
        document.getElementById("minifyBtn").classList.add("hidden");
        document.getElementById("formatBtn").classList.remove("hidden");

    } catch (error) {

        alert(getJSONErrorMessage(error));

    }

}
function showFormatButton() {

    document.getElementById("formatBtn").classList.remove("hidden");
    document.getElementById("minifyBtn").classList.add("hidden");

    isSorted = false;

    document.querySelector("#sortBtn .text-xs").textContent = "Sort";

    isMinified = false;

}
function clearJSON() {

    document.getElementById("input").value = "";
    document.getElementById("output").textContent = "";

    // છેલ્લું formatted JSON પણ clear કરો
    lastFormattedJSON = "";

    // Format button ફરી બતાવો
    document.getElementById("formatBtn").classList.remove("hidden");
    document.getElementById("formatBtn").classList.remove("hidden");
    document.getElementById("minifyBtn").classList.add("hidden");

    isSorted = false;
    originalJSON = "";
    isMinified = false;

    document.querySelector("#sortBtn .text-xs").textContent = "Sort";

    compareLeftJSON = "";
    compareRightJSON = "";
    compareSide = "left";
}

function copyOutput() {

    const output = document.getElementById("output").textContent;

    if (output.trim() === "") {

        alert("Nothing to copy.");
        return;

    }

    navigator.clipboard.writeText(output);

    alert("Copied successfully!");

}

function sortJSON() {
    const input = document.getElementById("input").value.trim();
    const output = document.getElementById("output");

    if (!input) {
        alert("⚠️ Please paste some JSON first.");
        return;
    }

    try {
        if (isSorted) {

            updateOutput(originalJSON);


            isSorted = false;

            document.querySelector("#sortBtn .text-xs").textContent = "Sort";

            return;
        }

        const json = JSON.parse(input);

        function deepSort(data) {

            // Arrays
            if (Array.isArray(data)) {

                // પહેલા દરેક element ને recursively sort કરો
                let arr = data.map(deepSort);

                // Numbers
                if (arr.every(v => typeof v === "number")) {
                    return arr.sort((a, b) => a - b);
                }

                // Strings
                if (arr.every(v => typeof v === "string")) {
                    return arr.sort((a, b) => a.localeCompare(b));
                }

                // Booleans
                if (arr.every(v => typeof v === "boolean")) {
                    return arr.sort();
                }

                // Objects
                if (arr.every(v => typeof v === "object" && v !== null && !Array.isArray(v))) {

                    // પ્રથમ key મુજબ sort
                    const firstKey = Object.keys(arr[0]).sort()[0];

                    return arr.sort((a, b) => {

                        const av = a[firstKey];
                        const bv = b[firstKey];

                        if (typeof av === "number" && typeof bv === "number") {
                            return av - bv;
                        }

                        return String(av).localeCompare(String(bv));

                    });

                }

                return arr;
            }

            // Objects
            if (typeof data === "object" && data !== null) {

                const result = {};

                Object.keys(data)
                    .sort()
                    .forEach(key => {
                        result[key] = deepSort(data[key]);
                    });

                return result;
            }

            return data;
        }

        const sorted = deepSort(json);

        if (isMinified) {

            updateOutput(JSON.stringify(sorted));

        } else {

            updateOutput(JSON.stringify(sorted, null, 2));

        }

        isSorted = true;

        document.querySelector("#sortBtn .text-xs").textContent = "Unsort";

    } catch (error) {

        output.textContent = "";

        alert(
            "❌ Invalid JSON\n\n" +
            error.message
        );

    }
}

function getJSONErrorMessage(error) {

    const msg = error.message;

    if (msg.includes("Expected property name")) {
        return "❌ Property names (keys) must be enclosed in double quotes (\").\n\nExample:\n\n❌ name: \"John\"\n\n✅ \"name\": \"John\"";
    }

    if (msg.includes("Unexpected end of JSON")) {
        return "❌ Your JSON is incomplete.\n\nA closing '}' or ']' is probably missing.";
    }

    if (msg.includes("Unexpected token")) {
        return "❌ Unexpected character found.\n\nCheck for:\n• Extra comma\n• Missing comma\n• Invalid quotes\n• Invalid characters";
    }

    if (msg.includes("Expected ','")) {
        return "❌ Missing comma between properties.";
    }

    if (msg.includes("Expected ':'")) {
        return "❌ Missing ':' between key and value.";
    }

    if (msg.includes("position")) {
        return "❌ Invalid JSON.\n\n" + msg;
    }

    return "❌ Invalid JSON.\n\n" + msg;
}

function updateOutput(jsonText) {
    const output = document.getElementById("output");

    // જૂનું highlighting દૂર કરો
    output.removeAttribute("data-highlighted");
    output.textContent = jsonText;

    // ફરી highlight કરો
    hljs.highlightElement(output);
}

