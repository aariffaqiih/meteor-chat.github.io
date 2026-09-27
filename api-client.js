async function callAPI(messages) {
    if (API_KEYS.length === 0) {
        throw new Error("Belum ada API key. Buka config.js atau index.html dan isi bagian API_KEYS.");
    }

    for (const entry of API_KEYS) {
        const provider = PROVIDERS[entry.provider];
        if (!provider) continue;

        let systemContent = SYSTEM_MESSAGE.content + "\n\nInformasi Real-Time Perangkat User:\nWaktu saat ini: " + new Date().toLocaleString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: "short" });
        if (knowledgeJadwalKuliah) {
            systemContent += "\n\nJadwal Kuliah User:\n" + knowledgeJadwalKuliah;
        }

        const systemMessageWithTime = {
            role: "system",
            content: systemContent
        };

        const payload = {
            model: provider.model,
            messages: [systemMessageWithTime, ...messages],
            stream: true,
        };

        if (entry.provider === "openrouter") {
            payload.max_tokens = 3072;
            payload.provider = { max_price: { prompt: 0, completion: 0, request: 0 } };
        } else {
            payload.max_completion_tokens = 4096;
            payload.reasoning_effort = "medium";
        }

        abortController = new AbortController();

        try {
            const headers = {
                "Content-Type": "application/json",
                Authorization: `Bearer ${entry.key}`,
            };
            if (entry.provider === "openrouter") {
                const referer = (location.protocol === "http:" || location.protocol === "https:")
                    ? location.href
                    : "https://meteor-chat.github.io/";
                headers["HTTP-Referer"] = referer;
                headers["X-Title"] = "Meteor";
            }

            const response = await fetch(provider.url, {
                method: "POST",
                headers,
                body: JSON.stringify(payload),
                signal: abortController.signal,
            });

            if (!response.ok) {
                const errText = await response.text().catch(() => "");
                console.warn(`[Meteor] ${entry.provider} (${provider.model}) HTTP ${response.status}:`, errText);
                continue;
            }

            let fullText = "";
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });

                const lines = buffer.split("\n");
                buffer = lines.pop();

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || !trimmed.startsWith("data: ")) continue;
                    const data = trimmed.slice(6).trim();
                    if (data === "[DONE]") continue;
                    try {
                        const parsed = JSON.parse(data);
                        const delta = parsed.choices?.[0]?.delta?.content
                            || parsed.choices?.[0]?.text
                            || "";
                        if (delta) {
                            fullText += delta;
                            updateStreamingMessage(fullText);
                        }
                    } catch {}
                }
            }

            if (!fullText && buffer.trim()) {
                try {
                    const parsed = JSON.parse(buffer.trim());
                    fullText = parsed.choices?.[0]?.message?.content || "";
                } catch {}
            }

            fullText = fullText.trim();
            if (fullText) return protectIdentity(fullText);
        } catch (err) {
            if (err.name === "AbortError") throw err;
            console.warn(`[Meteor] Error connecting to ${entry.provider}:`, err);
            continue;
        }
    }

    throw new Error("Kapasitas server Meteor sedang mencapai batas maksimum karena tingginya volume antrean pengguna. Silakan coba beberapa saat lagi untuk mengamankan slot komputasi Anda.");
}
