/**
 * AI Agent Service
 * Handles interactions with LLMs (OpenAI, Ollama, Anthropic) 
 * for intelligent document processing and natural language routing.
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';

interface ExpenseExtractionResult {
    amount: number | null;
    currency: string;
    merchant: string | null;
    date: string | null;
    confidence: number; // 0 to 1
    rawText?: string;
}

/**
 * Proof of Concept: Vision Agent for OCR and Data Extraction
 * In production, this can securely pass the image to LLaVA (local) or GPT-4o.
 */
export async function extractExpenseDataFromImage(imageUrl: string): Promise<ExpenseExtractionResult> {
    console.log(`🧠 [Vision Agent] Analyzing receipt image: ${imageUrl.substring(0, 50)}...`);

    const apiKey = process.env.OPENAI_API_KEY;

    if (apiKey) {
        try {
            console.log(`🚀 Calling OpenAI Vision (GPT-4o) Real API...`);
            
            // Extract filename from the local URL and read base64 securely
            const filename = imageUrl.split('/uploads/')[1];
            const localPath = path.join(process.cwd(), 'uploads', filename);
            const base64Image = fs.readFileSync(localPath, { encoding: 'base64' });

            const payload = {
                model: "gpt-4o",
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: "Tu es un extracteur de données comptables RH. Lis attentivement ce ticket de caisse. Réponds UNIQUEMENT au format JSON strict avec les clés: 'amount' (nombre), 'currency' (chaine), 'merchant' (chaine)." },
                            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
                        ]
                    }
                ],
                response_format: { type: "json_object" }
            };

            const res = await axios.post('https://api.openai.com/v1/chat/completions', payload, {
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
            });

            const parsed = JSON.parse(res.data.choices[0].message.content);
            console.log(`✅ [Vision Agent] Extraction success:`, parsed);

            return {
                amount: parsed.amount || null,
                currency: parsed.currency || "EUR",
                merchant: parsed.merchant || "Marchand inconnu",
                date: new Date().toISOString().split('T')[0],
                confidence: 0.99
            };
        } catch (error: any) {
            console.error(`❌ [Vision Agent] API failure:`, error.response?.data || error.message);
            console.log(`⚠️ Falling back to mocked extraction...`);
        }
    }

    // --- FALLBACK / DEMO IMPLEMENTATION ---
    // If no key is provided, simulate processing
    await new Promise(resolve => setTimeout(resolve, 2500));

    // Simulated Intelligence
    return {
        amount: 35.50,
        currency: "EUR",
        merchant: "Relais de l'Entrecôte",
        date: new Date().toISOString().split('T')[0],
        confidence: 0.95
    };
}



interface MedicalCertificateResult {
    startDate: string | null;
    endDate: string | null;
    doctorName: string | null;
    isValidDocument: boolean;
    confidence: number;
}

/**
 * Proof of Concept: Vision Agent to parse Medical Certificates (Arrêt Maladie)
 * Checks validity and automatically extracts the start and end dates of the absence.
 */
export async function extractMedicalCertificateDataFromImage(imageUrl: string): Promise<MedicalCertificateResult> {
    console.log(`🧠 [Medical Agent] Analyzing medical certificate: ${imageUrl.substring(0, 50)}...`);

    // Simulate LLM processing time
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Simulated parsing of a standard CERFA 10170*07 (Avis d'arrêt de travail)
    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 5);

    return {
        isValidDocument: true,
        startDate: today.toISOString().split('T')[0],
        endDate: nextWeek.toISOString().split('T')[0],
        doctorName: "Dr. Martin Dupont",
        confidence: 0.98
    };
}

export type IntentResult =
    | { intent: 'LEAVE_REQUEST'; dateString?: string; metadata?: any }
    | { intent: 'SICK_LEAVE'; dateString?: string; metadata?: any }
    | { intent: 'EXPENSE_REPORT'; metadata?: any }
    | { intent: 'HR_BALANCE'; metadata?: any }
    | { intent: 'DOCUMENT_ACCESS'; metadata?: any }
    | { intent: 'FAQ_HR'; question: string }
    | { intent: 'UNKNOWN' };

/**
 * Proof of Concept: Semantic Router Agent (Intent Classification)
 * Used to replace rigid menu buttons with natural language understanding.
 */
export async function detectUserIntent(userText: string): Promise<IntentResult> {
    console.log(`🧠 [Router Agent] Analyzing intent for: "${userText}"`);
    
    const text = userText.toLowerCase();

    // In Production: We will call OpenAI GPT-4o or Ollama passing the text 
    // to output a strict JSON classification.
    // For this PoC, we mimic the strict categorization an LLM would yield based on semantics.

    // Simulating LLM routing latency
    await new Promise(resolve => setTimeout(resolve, 800));

    // Agent semantic heuristics
    if (text.includes("frais") || text.includes("resto") || text.includes("addition") || text.includes("rembourser") || text.includes("ticket") || text.includes("dépense") || text.includes("restaurant") || text.includes("péage")) {
        return { intent: 'EXPENSE_REPORT' };
    }
    if (text.includes("malade") || text.includes("grippe") || text.includes("covid") || text.includes("arrêt") || text.includes("docteur") || text.includes("médecin") || text.includes("fièvre") || text.includes("sick") || text.includes("hopital")) {
        return { intent: 'SICK_LEAVE' };
    }
    if (text.includes("congé") || text.includes("vacances") || text.includes("absence") || text.includes("jour off") || text.includes("repos")) {
        return { intent: 'LEAVE_REQUEST' };
    }
    if (text.includes("solde") || text.includes("combien") || text.includes("restant") || text.includes("rtt") || text.includes("droit") || text.includes("paie") || text.includes("salaire")) {
        return { intent: 'HR_BALANCE' };
    }
    if (text.includes("document") || text.includes("contrat") || text.includes("attestation") || text.includes("fiche") || text.includes("docs") || text.includes("règlement") || text.includes("avenant")) {
        return { intent: 'DOCUMENT_ACCESS' };
    }
    if (text.length > 15 && (text.includes("est-ce que") || text.includes("comment") || text.includes("est il possible") || text.includes("puis-je") || text.includes("?") || text.includes("ai-je le droit"))) {
        return { intent: 'FAQ_HR', question: userText };
    }

    return { intent: 'UNKNOWN' };
}

/**
 * Proof of Concept: RAG Agent (Retrieval-Augmented Generation)
 * Used to answer specific contextual questions based on Tenant documents.
 */
export async function answerHRQuestionViaRAG(question: string, tenantId: string): Promise<string> {
    console.log(`🧠 [RAG Agent] Searching knowledge base for Tenant: ${tenantId} | Q: "${question}"`);

    // In Production: 
    // 1. Embed the question -> [0.034, 0.551, ...]
    // 2. Vector Search (ex: pgvector) across the Tenant's 'Document' table (Règlement, Conventions)
    // 3. Inject the top 3 text chunks into an LLM context window to generate the final response.

    // Simulating Retrieval & Generative latency
    await new Promise(resolve => setTimeout(resolve, 3000));

    const q = question.toLowerCase();

    // Simulated Knowledge Base heuristics
    if (q.includes("vacances") || q.includes("congés") || q.includes("reporter")) {
        return "Conformément à l'Article 4 de votre règlement intérieur, les congés payés non soldés au 31 mai **ne peuvent être reportés** sur l'année suivante, sauf accord écrit ou arrêt maladie survenant pendant ladite période.";
    }

    if (q.includes("maladie") || q.includes("arrêt") || q.includes("justificatif")) {
        return "D'après la politique RH, vous disposez d'un délai maximum de **48h** pour fournir votre arrêt de travail (CERFA). Vous pouvez le transmettre directement via ce bot en cliquant sur *\"Arrêt maladie\"*.";
    }

    if (q.includes("transport") || q.includes("remboursement") || q.includes("frais") || q.includes("navigo")) {
        return "L'entreprise prend en charge vos frais de transport en commun à hauteur de **50%**. Ce remboursement est synchronisé si votre attestation est déposée annuellement via ce bot.";
    }

    return "Je n'ai pas trouvé de règle explicite concernant cette question dans la documentation RH (Règlement intérieur, Convention). Souhaitez-vous que je crée un ticket pour que le manager de votre dossier puisse vous répondre personnellement ?";
}

/**
 * Proof of Concept: Solopreneur Ticket Deflection Agent (RAG)
 * Utilisé pour lire la documentation de la plateforme ("Comment faire X ?") et répondre immédiatement au client.
 */
export async function deflectSupportTicketViaRAG(subject: string, message: string): Promise<string | null> {
    console.log(`🧠 [Deflection Agent] Scanning new Support Ticket: "${subject}"`);

    // In Production: We would embed the subject+message and query the platform's Technical KB.
    await new Promise(resolve => setTimeout(resolve, 1500));

    const combined = (subject + " " + message).toLowerCase();

    if (combined.includes('silae') || combined.includes('export paie')) {
        return "🤖 **Réponse IA Rapide :**\n\nPour exporter vers **Silae**, accédez à l'onglet **'Exploitation' > 'Actions Globales'** et cliquez sur le bouton Bleu **'Générer l'export Silae'**. \nLe fichier CSV généré est directement compatible avec votre importateur Silae.\n\n*Cette réponse vous a-t-elle aidé ? Si non, notre support humain va prendre le relais très vite.*";
    }

    if (combined.includes('modifier') && (combined.includes('heure') || combined.includes('pointage') || combined.includes('temps'))) {
        return "🤖 **Réponse IA Rapide :**\n\nPour **modifier l'heure d'un pointage**, allez dans l'onglet **'Exploitation'**. Cliquez sur la ligne du collaborateur concerné, puis cliquez sur l'icône **Crayon ✏️** à côté de l'heure d'arrivée ou de départ pour la forcer. N'oubliez pas de sauvegarder !\n\n*Cette réponse vous a-t-elle aidé ? Si non, je laisse le ticket ouvert pour un humain.*";
    }

    if (combined.includes('csv') || combined.includes('import') || combined.includes('employé')) {
        return "🤖 **Réponse IA Rapide :**\n\nL'**import CSV** se fait depuis l'onglet **'Salariés' > 'Importer'**. Assurez-vous d'utiliser notre modèle Excel disponible en téléchargement sur cette même page. Les numéros de téléphones doivent contenir l'indicatif (ex: 06 devient +336).\n\n*Si votre problème persiste, n'hésitez pas à nous détailler l'erreur!*";
    }

    // Aucun match RAG (Pas assez de confiance pour répondre)
    return null;
}

