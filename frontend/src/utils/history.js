const HISTORY_KEY = "vigil_detection_history";

export function getHistory() {
    try {
        const stored = localStorage.getItem(HISTORY_KEY);

        if (!stored) {
            return [];
        }

        return JSON.parse(stored);
    } catch (error) {
        console.error("Could not load VIGIL history:", error);
        return [];
    }
}


export function saveHistory(entry) {
    try {
        const history = getHistory();

        const newEntry = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            ...entry,
        };

        const updatedHistory = [
            newEntry,
            ...history,
        ];

        localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));

        window.dispatchEvent(new Event("vigil-history-updated"));

        return newEntry;

    } catch (error) {
        console.error("Could not save VIGIL history:", error);
        return null;
    }
}


export function clearHistory() {
    localStorage.removeItem(HISTORY_KEY);

    window.dispatchEvent(
        new Event("vigil-history-updated")
    );
}


const SETTINGS_KEY = "vigil_settings";

export function isHistoryAutoSaveEnabled() {
    try {
        const stored =
            localStorage.getItem(SETTINGS_KEY);

        if (!stored) {
            return true;
        }

        const settings = JSON.parse(stored);

        return settings.autoSaveHistory !== false;

    } catch (error) {
        console.error(
            "Could not load VIGIL settings:",
            error
        );

        return true;
    }
}

export function isConfidenceVisible() {
    try {
        const stored =
            localStorage.getItem("vigil_settings");

        if (!stored) {
            return true;
        }

        const settings = JSON.parse(stored);

        return settings.showConfidence !== false;
    } catch (error) {
        console.error(
            "Could not load VIGIL settings:",
            error
        );

        return true;
    }
}