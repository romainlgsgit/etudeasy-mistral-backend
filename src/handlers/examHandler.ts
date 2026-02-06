/**
 * Handler pour la génération d'examens blancs avec Mistral AI
 * Supporte l'analyse d'images via Pixtral (modèle vision de Mistral)
 * Supporte les PDFs via Firebase Storage URLs
 */

import { Request, Response } from 'express';
import { callMistralVisionAPI } from '../services/mistral';
// Note: fetch est natif dans Node.js 18+

function getLangInstruction(language?: string): string {
  if (language === 'es') {
    return '🌍 LANGUAGE RULE: ALL questions, explanations, options, and text in your response MUST be written in Spanish (español). Never use French. This includes the title, questions, options, correctAnswer, explanation, and keywords fields.\n\n';
  }
  return '';
}

interface Question {
  id: string;
  question: string;
  type: 'multiple-choice' | 'open-ended';
  options?: string[];
  correctAnswer: string;
  explanation?: string;
  keywords?: string[]; // Mots-clés pour évaluation des réponses ouvertes
}

interface MockExam {
  title: string;
  subject: string;
  duration: number;
  difficulty: 'Facile' | 'Moyen' | 'Difficile';
  questions: Question[];
}

/**
 * Handler pour évaluer une réponse textuelle avec l'IA
 */
export async function evaluateAnswerHandler(req: Request, res: Response) {
  try {
    const { question, userAnswer, correctAnswer, keywords, language } = req.body;
    const userId = (req as any).userId;

    console.log('[EvaluateAnswerHandler] Requête reçue');
    console.log('[EvaluateAnswerHandler] UserId:', userId);

    // Construire le prompt pour évaluer la réponse
    const prompt = `${getLangInstruction(language)}Tu es un correcteur expert et bienveillant.

QUESTION POSÉE:
${question}

RÉPONSE ATTENDUE:
${correctAnswer}

MOTS-CLÉS IMPORTANTS:
${keywords?.join(', ') || 'Non spécifiés'}

RÉPONSE DE L'ÉTUDIANT:
${userAnswer}

TÂCHE:
Évalue la réponse de l'étudiant en comparant avec la réponse attendue et les mots-clés.
Donne un score sur 100 basé sur:
- Présence des concepts clés (50%)
- Précision et exactitude (30%)
- Clarté de l'explication (20%)

Sois bienveillant mais juste. Accepte les formulations différentes si le concept est correct.

IMPORTANT: Réponds UNIQUEMENT avec un objet JSON valide dans ce format exact:
{
  "score": 85,
  "feedback": "Explication détaillée du score",
  "foundKeywords": ["mot-clé trouvé 1", "mot-clé trouvé 2"],
  "missingKeywords": ["mot-clé manquant 1"],
  "isCorrect": true
}`;

    // Appeler Mistral AI
    const mistralMessage = {
      role: 'user',
      content: prompt,
    };

    const mistralResponse = await callMistralVisionAPI([mistralMessage], false);

    console.log('[EvaluateAnswerHandler] Réponse Mistral reçue');

    // Parser la réponse
    const evaluation = parseEvaluationFromResponse(mistralResponse.content);

    res.json({
      success: true,
      evaluation: evaluation,
    });
  } catch (error: any) {
    console.error('[EvaluateAnswerHandler] Erreur:', error);

    // Retourner une évaluation de fallback
    res.json({
      success: true,
      evaluation: {
        score: 50,
        feedback: 'Évaluation automatique indisponible. Votre réponse a été enregistrée.',
        foundKeywords: [],
        missingKeywords: [],
        isCorrect: false,
      },
      fallback: true,
    });
  }
}

/**
 * Parse la réponse d'évaluation de Mistral
 */
function parseEvaluationFromResponse(content: string): any {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        score: parsed.score || 50,
        feedback: parsed.feedback || 'Évaluation en cours',
        foundKeywords: Array.isArray(parsed.foundKeywords) ? parsed.foundKeywords : [],
        missingKeywords: Array.isArray(parsed.missingKeywords) ? parsed.missingKeywords : [],
        isCorrect: parsed.isCorrect !== undefined ? parsed.isCorrect : parsed.score >= 60,
      };
    }
    throw new Error('Pas de JSON trouvé');
  } catch (error) {
    return {
      score: 50,
      feedback: 'Évaluation automatique indisponible',
      foundKeywords: [],
      missingKeywords: [],
      isCorrect: false,
    };
  }
}

/**
 * Télécharge un fichier depuis Firebase Storage et le convertit en base64
 */
async function downloadFileFromStorage(storageUrl: string): Promise<string> {
  try {
    console.log('[ExamHandler] Téléchargement du fichier depuis Firebase Storage...');
    const response = await fetch(storageUrl);

    if (!response.ok) {
      throw new Error(`Erreur téléchargement: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');

    console.log('[ExamHandler] Fichier téléchargé:', {
      size: (buffer.length / 1024 / 1024).toFixed(2) + ' MB',
      base64Length: base64.length,
    });

    return base64;
  } catch (error) {
    console.error('[ExamHandler] Erreur téléchargement Firebase Storage:', error);
    throw new Error('Impossible de télécharger le fichier depuis Firebase Storage');
  }
}

/**
 * Handler pour générer un examen blanc
 */
export async function generateExamHandler(req: Request, res: Response) {
  try {
    const { documents, text, subject, language } = req.body;
    const userId = (req as any).userId;

    console.log('[ExamHandler] Requête reçue');
    console.log('[ExamHandler] UserId:', userId);
    console.log('[ExamHandler] Subject:', subject);
    console.log('[ExamHandler] Documents:', documents?.length || 0);
    console.log('[ExamHandler] Text length:', text?.length || 0);

    // Télécharger les fichiers depuis Firebase Storage si nécessaire
    if (documents && documents.length > 0) {
      for (const doc of documents) {
        if (doc.storageUrl && !doc.content) {
          console.log(`[ExamHandler] Document ${doc.name} a une URL Firebase Storage, téléchargement...`);
          try {
            doc.content = await downloadFileFromStorage(doc.storageUrl);
            console.log(`[ExamHandler] Document ${doc.name} téléchargé avec succès`);
          } catch (error) {
            console.error(`[ExamHandler] Erreur téléchargement ${doc.name}:`, error);
            // Continuer avec les autres documents même si un échoue
          }
        }
      }
    }

    // Construire le prompt pour Mistral
    let prompt = '';

    if (text) {
      // Génération à partir d'un texte
      prompt = buildPromptFromText(text, subject, language);
    } else if (documents && documents.length > 0) {
      // Génération à partir de documents
      prompt = buildPromptFromDocuments(documents, subject, language);
    } else {
      // Génération générique
      prompt = buildGenericPrompt(subject, language);
    }

    console.log('[ExamHandler] Prompt construit:', prompt.substring(0, 200) + '...');

    // Vérifier si on a des images à analyser
    const hasImages = documents && documents.some((doc: any) => doc.type === 'image' && doc.content);

    console.log('[ExamHandler] hasImages:', hasImages);
    if (documents) {
      documents.forEach((doc: any, index: number) => {
        console.log(`[ExamHandler] Document ${index}:`, {
          name: doc.name,
          type: doc.type,
          hasContent: !!doc.content,
          contentLength: doc.content ? doc.content.length : 0,
        });
      });
    }

    // Construire le message pour Mistral
    let mistralMessage: any;
    if (hasImages) {
      console.log('[ExamHandler] Building multi-modal message with images');

      // Utiliser le format multi-modal avec images
      const content: any[] = [{ type: 'text', text: prompt }];

      // Ajouter les images
      documents.forEach((doc: any) => {
        if (doc.type === 'image' && doc.content) {
          content.push({
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${doc.content}`,
            },
          });
        }
      });

      mistralMessage = {
        role: 'user',
        content: content,
      };
    } else {
      // Format texte simple
      mistralMessage = {
        role: 'user',
        content: prompt,
      };
    }

    // Appeler Mistral AI (Pixtral si images, sinon modèle texte)
    const mistralResponse = await callMistralVisionAPI([mistralMessage], hasImages);

    console.log('[ExamHandler] Réponse Mistral reçue');
    console.log('[ExamHandler] Réponse brute (500 premiers caractères):', mistralResponse.content?.substring(0, 500));

    // Parser la réponse de Mistral
    const exam = parseExamFromResponse(mistralResponse.content, subject);

    console.log('[ExamHandler] Examen parsé:', {
      title: exam.title,
      questions: exam.questions.length,
    });

    // Vérifier si l'examen semble générique (indication que l'image n'a pas été bien lue)
    if (hasImages) {
      const genericIndicators = [
        'notion fondamentale',
        'concept important',
        'cette matière',
        'niveau général',
        'principe est important',
        'approche est recommandée',
      ];
      const examText = JSON.stringify(exam).toLowerCase();
      const isGeneric = genericIndicators.some(indicator => examText.includes(indicator));

      if (isGeneric) {
        console.warn('[ExamHandler] ⚠️ ATTENTION: L\'examen généré semble générique!');
        console.warn('[ExamHandler] Le modèle n\'a peut-être pas bien lu le contenu de l\'image.');
        console.warn('[ExamHandler] Sujet demandé:', subject);
        console.warn('[ExamHandler] Titre généré:', exam.title);
        console.warn('[ExamHandler] Première question:', exam.questions[0]?.question);
      } else {
        console.log('[ExamHandler] ✅ L\'examen semble spécifique au contenu de l\'image');
      }
    }

    res.json({
      success: true,
      exam: exam,
      message: 'Examen généré avec succès',
    });
  } catch (error: any) {
    console.error('[ExamHandler] Erreur:', error);

    // En cas d'erreur, retourner un examen de fallback
    const fallbackExam = generateFallbackExam(req.body.subject);

    res.json({
      success: true,
      exam: fallbackExam,
      message: 'Examen généré en mode hors ligne',
      fallback: true,
    });
  }
}

/**
 * Construit un prompt à partir d'un texte
 */
function buildPromptFromText(text: string, subject?: string, language?: string): string {
  return `${getLangInstruction(language)}Tu es un professeur expert qui crée des examens de qualité sur des sujets académiques.

TEXTE DE L'UTILISATEUR:
${text}

TA MISSION:
Si le texte est une simple demande (ex: "fait moi un examen sur X"), IDENTIFIE LE SUJET (X) et génère un examen complet sur ce sujet avec de VRAIES QUESTIONS SUR LE SUJET.
Si le texte contient du contenu pédagogique, génère un examen basé sur ce contenu.

IMPORTANT: Tu dois générer des VRAIES QUESTIONS SUR LE SUJET demandé, PAS des questions sur comment créer l'examen.
Exemple: Si on demande "examen sur les dinosaures", pose des questions comme "Quelle période a vu l'extinction des dinosaures?", PAS "Combien de questions voulez-vous?".

INSTRUCTIONS:
1. Crée 12 questions au total :
   - 6 questions QCM (4 options chacune)
   - 6 questions à réponse ouverte (l'étudiant doit écrire sa réponse)
2. Les questions doivent porter SUR LE SUJET demandé (concepts, faits, théories du domaine)
3. Varie la difficulté (4 faciles, 5 moyennes, 3 difficiles)
4. Pour les QCM : fournis une explication claire pour chaque réponse correcte
5. Pour les questions ouvertes : fournis la réponse attendue ET des mots-clés importants

IMPORTANT: Réponds UNIQUEMENT avec un objet JSON valide dans ce format exact.
ATTENTION : Utilise des guillemets droits (") et non des guillemets courbes (" "). Échappe correctement les guillemets avec \\" si nécessaire.

{
  "title": "Titre de l'examen",
  "subject": "${subject || 'Général'}",
  "duration": 90,
  "difficulty": "Moyen",
  "questions": [
    {
      "id": "1",
      "type": "multiple-choice",
      "question": "Question QCM ici?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option A",
      "explanation": "Explication de la réponse"
    },
    {
      "id": "2",
      "type": "open-ended",
      "question": "Question ouverte ici?",
      "correctAnswer": "Réponse attendue détaillée",
      "keywords": ["mot-clé1", "mot-clé2", "concept important"],
      "explanation": "Explication de la réponse"
    }
  ]
}`;
}

/**
 * Construit un prompt à partir de documents
 */
function buildPromptFromDocuments(documents: any[], subject?: string, language?: string): string {
  const hasImages = documents.some((doc: any) => doc.type === 'image' && doc.content);
  const docNames = documents.map(d => d.name).join(', ');

  let prompt = `${getLangInstruction(language)}Tu es un professeur expert qui crée des examens de qualité académiques.\n\n`;

  if (hasImages) {
    prompt += `🔍 ÉTAPE 1 - ANALYSE OBLIGATOIRE DE L'IMAGE:
Tu DOIS d'abord lire attentivement TOUT le contenu visible dans l'image/les images.
Les images peuvent contenir:
- Des cours manuscrits ou imprimés
- Des exercices (TD, TP)
- Des formules mathématiques ou scientifiques
- Des schémas, graphiques, tableaux
- Du texte dense avec des données techniques

IMPORTANT: Lis CHAQUE ligne de texte visible, même si c'est:
- Du texte petit ou serré
- Des formules avec des exposants/indices
- Des listes de données numériques
- Des exercices avec plusieurs sous-questions

🎯 ÉTAPE 2 - GÉNÉRATION DE L'EXAMEN:
Génère un examen basé EXCLUSIVEMENT sur le contenu que tu as lu dans l'image.
Si tu vois un TD de "Machines hydrauliques", tes questions doivent porter sur les pompes, débits, pressions, etc.
Si tu vois des exercices de maths, tes questions doivent reprendre ces exercices ou concepts similaires.

⚠️ RÈGLE CRITIQUE:
Si tu n'arrives pas à lire le contenu de l'image clairement, tu DOIS quand même essayer de deviner le sujet d'après ce que tu peux voir (titres, formules partielles, schémas) et générer des questions sur CE sujet spécifique.
NE GÉNÈRE JAMAIS un examen générique si tu peux identifier un sujet dans l'image.\n\n`;
  } else {
    prompt += `À partir des documents suivants: ${docNames}\n\n`;
  }

  prompt += `MISSION: Crée un examen blanc complet sur le sujet "${subject || 'niveau général'}" avec de VRAIES QUESTIONS académiques BASÉES SUR LE CONTENU VISIBLE.\n\n`;

  prompt += `IMPORTANT: Génère des VRAIES QUESTIONS sur ${subject || 'le sujet'} basées sur le contenu des documents, PAS des questions méta sur comment créer l'examen.
Exemples de bonnes questions: "Quelle est la formule de...", "Expliquez le concept de...", "Calculez..."
Exemples de MAUVAISES questions: "Combien de questions voulez-vous?", "Quel thème préférez-vous?"

INSTRUCTIONS:
1. Crée 15 questions au total :
   - 8 questions QCM (4 options chacune)
   - 7 questions à réponse ouverte (l'étudiant doit écrire sa réponse)
2. Les questions doivent couvrir les concepts principaux vus dans les documents
3. Varie la difficulté (5 faciles, 6 moyennes, 4 difficiles)
4. Pour les QCM : fournis une explication claire pour chaque réponse correcte
5. Pour les questions ouvertes : fournis la réponse attendue ET des mots-clés importants
${hasImages ? '6. OBLIGATOIRE: Base les questions sur le contenu SPÉCIFIQUE que tu vois dans les images (ex: si tu vois un TD de pompes hydrauliques, pose des questions sur les pompes, débits, rendements, etc.)\n' : ''}

IMPORTANT: Réponds UNIQUEMENT avec un objet JSON valide dans ce format exact.
ATTENTION : Utilise des guillemets droits (") et non des guillemets courbes (" "). Échappe correctement les guillemets avec \\" si nécessaire.

{
  "title": "Examen Blanc - ${subject || 'Général'}",
  "subject": "${subject || 'Général'}",
  "duration": 120,
  "difficulty": "Moyen",
  "questions": [
    {
      "id": "1",
      "type": "multiple-choice",
      "question": "Question QCM ici?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option A",
      "explanation": "Explication de la réponse"
    },
    {
      "id": "2",
      "type": "open-ended",
      "question": "Question ouverte ici?",
      "correctAnswer": "Réponse attendue détaillée",
      "keywords": ["mot-clé1", "mot-clé2", "concept important"],
      "explanation": "Explication de la réponse"
    }
  ]
}`;

  return prompt;
}

/**
 * Construit un prompt générique
 */
function buildGenericPrompt(subject?: string, language?: string): string {
  return `${getLangInstruction(language)}Tu es un professeur expert qui crée des examens de qualité académiques.

MISSION: Crée un examen blanc complet sur le sujet "${subject || 'niveau général'}" avec de VRAIES QUESTIONS SUR CE SUJET.

IMPORTANT: Génère des VRAIES QUESTIONS académiques sur ${subject || 'ce sujet'}, PAS des questions méta sur comment créer l'examen.
Exemples de bonnes questions: "Quelle est la formule de...", "Expliquez le concept de...", "Qui a découvert..."
Exemples de MAUVAISES questions: "Combien de questions voulez-vous?", "Quel format préférez-vous?"

INSTRUCTIONS:
1. Crée 10 questions au total :
   - 5 questions QCM (4 options chacune)
   - 5 questions à réponse ouverte (l'étudiant doit écrire sa réponse)
2. Les questions doivent couvrir les concepts fondamentaux et importants de ${subject || 'la matière'}
3. Varie la difficulté (3 faciles, 5 moyennes, 2 difficiles)
4. Pour les QCM : fournis une explication claire pour chaque réponse correcte
5. Pour les questions ouvertes : fournis la réponse attendue ET des mots-clés importants

IMPORTANT: Réponds UNIQUEMENT avec un objet JSON valide dans ce format exact.
ATTENTION : Utilise des guillemets droits (") et non des guillemets courbes (" "). Échappe correctement les guillemets avec \\" si nécessaire.

{
  "title": "Examen Blanc - ${subject || 'Général'}",
  "subject": "${subject || 'Général'}",
  "duration": 90,
  "difficulty": "Moyen",
  "questions": [
    {
      "id": "1",
      "type": "multiple-choice",
      "question": "Question QCM ici?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option A",
      "explanation": "Explication de la réponse"
    },
    {
      "id": "2",
      "type": "open-ended",
      "question": "Question ouverte ici?",
      "correctAnswer": "Réponse attendue détaillée",
      "keywords": ["mot-clé1", "mot-clé2", "concept important"],
      "explanation": "Explication de la réponse"
    }
  ]
}`;
}

/**
 * Nettoie une chaîne JSON pour éviter les erreurs de parsing
 */
function sanitizeJsonString(str: string): string {
  // Nettoyer les guillemets curly et autres caractères problématiques
  let cleaned = str
    .replace(/[""]/g, '"')  // Remplacer les guillemets curly par des guillemets droits
    .replace(/['']/g, "'")  // Remplacer les apostrophes curly par des apostrophes droites
    .replace(/\u00A0/g, ' ') // Remplacer les espaces insécables par des espaces normaux
    .replace(/…/g, '...'); // Remplacer les ellipses par trois points

  return cleaned;
}

/**
 * Parse la réponse de Mistral pour extraire l'examen
 */
function parseExamFromResponse(content: string, subject?: string): MockExam {
  try {
    console.log('[ExamHandler] Début du parsing, longueur contenu:', content.length);

    // Nettoyer le contenu en enlevant les balises markdown (```json ... ```)
    let cleanContent = content.trim();
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/```\s*$/, '');
    } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```\s*/, '').replace(/```\s*$/, '');
    }

    // Nettoyer les caractères problématiques
    cleanContent = sanitizeJsonString(cleanContent);

    // Essayer de trouver le JSON dans la réponse (non-greedy)
    const jsonMatch = cleanContent.match(/\{[\s\S]*?\}\s*$/);
    if (jsonMatch) {
      console.log('[ExamHandler] JSON trouvé, longueur:', jsonMatch[0].length);

      // Log d'un extrait pour debug (premiers et derniers caractères)
      const jsonStr = jsonMatch[0];
      console.log('[ExamHandler] Début JSON:', jsonStr.substring(0, 100));
      console.log('[ExamHandler] Fin JSON:', jsonStr.substring(jsonStr.length - 100));

      let parsed;
      try {
        parsed = JSON.parse(jsonStr);
      } catch (parseError: any) {
        console.error('[ExamHandler] Erreur JSON.parse:', parseError.message);
        console.error('[ExamHandler] Position erreur:', parseError.message.match(/position (\d+)/)?.[1]);

        // Si erreur de parsing, essayer de trouver et corriger le problème
        // Tentative 2 : parser avec une regex plus stricte pour trouver juste l'objet principal
        const strictMatch = cleanContent.match(/\{\s*"title"[\s\S]*"questions"\s*:\s*\[[\s\S]*?\]\s*\}/);
        if (strictMatch) {
          console.log('[ExamHandler] Tentative avec regex stricte...');
          parsed = JSON.parse(sanitizeJsonString(strictMatch[0]));
        } else {
          throw parseError;
        }
      }

      if (!parsed) {
        throw new Error('Parsing JSON a échoué');
      }

      console.log('[ExamHandler] JSON parsé avec succès, nombre de questions:', parsed.questions?.length || 0);

      // Valider que nous avons des questions
      if (!parsed.questions || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
        console.error('[ExamHandler] Pas de questions trouvées dans le JSON parsé');
        throw new Error('Aucune question trouvée dans la réponse');
      }

      // Valider et nettoyer les données
      const questions: Question[] = parsed.questions.map((q: any, index: number) => {
        const questionType = q.type || 'multiple-choice';

        if (questionType === 'open-ended') {
          return {
            id: `q_${index + 1}`,
            type: 'open-ended' as const,
            question: sanitizeJsonString(q.question || 'Question non définie'),
            correctAnswer: sanitizeJsonString(q.correctAnswer || 'Réponse non définie'),
            keywords: Array.isArray(q.keywords) ? q.keywords.map((k: string) => sanitizeJsonString(k)) : [],
            explanation: sanitizeJsonString(q.explanation || 'Pas d\'explication disponible'),
          };
        } else {
          const options = Array.isArray(q.options)
            ? q.options.map((opt: string) => sanitizeJsonString(opt))
            : ['Option A', 'Option B', 'Option C', 'Option D'];

          // Normaliser correctAnswer pour qu'il corresponde exactement à une option
          let correctAnswer = sanitizeJsonString(q.correctAnswer || options[0]);

          // Si correctAnswer ne correspond pas exactement à une option, trouver la plus proche
          if (!options.includes(correctAnswer)) {
            // Normaliser et comparer (sans casse, sans espaces superflus)
            const normalizedAnswer = correctAnswer.toLowerCase().trim();
            const matchingOption = options.find((opt: string) =>
              opt.toLowerCase().trim() === normalizedAnswer
            );
            correctAnswer = matchingOption || options[0];
          }

          return {
            id: `q_${index + 1}`,
            type: 'multiple-choice' as const,
            question: sanitizeJsonString(q.question || 'Question non définie'),
            options: options,
            correctAnswer: correctAnswer,
            explanation: sanitizeJsonString(q.explanation || 'Pas d\'explication disponible'),
          };
        }
      });

      const exam = {
        title: sanitizeJsonString(parsed.title || `Examen Blanc - ${subject || 'Général'}`),
        subject: sanitizeJsonString(parsed.subject || subject || 'Général'),
        duration: parsed.duration || 60,
        difficulty: parsed.difficulty || 'Moyen',
        questions: questions,
      };

      console.log('[ExamHandler] Examen créé avec succès:', {
        title: exam.title,
        subject: exam.subject,
        questionsCount: exam.questions.length,
      });

      return exam;
    }

    console.error('[ExamHandler] Pas de JSON trouvé dans la réponse');
    throw new Error('Pas de JSON trouvé dans la réponse');
  } catch (error: any) {
    console.error('[ExamHandler] Erreur parsing:', error);
    console.error('[ExamHandler] Stack:', error.stack);

    // Log un extrait du contenu pour debug
    if (content) {
      console.error('[ExamHandler] Extrait du contenu (premiers 500 caractères):', content.substring(0, 500));
      console.error('[ExamHandler] Extrait du contenu (derniers 500 caractères):', content.substring(Math.max(0, content.length - 500)));
    }

    return generateFallbackExam(subject);
  }
}

/**
 * Génère un examen de fallback
 */
function generateFallbackExam(subject?: string): MockExam {
  const subjectName = subject || 'Général';

  return {
    title: `Examen Blanc - ${subjectName}`,
    subject: subjectName,
    duration: 60,
    difficulty: 'Moyen',
    questions: [
      {
        id: 'q_1',
        type: 'multiple-choice',
        question: `Quelle est une notion fondamentale en ${subjectName} ?`,
        options: [
          'Les bases théoriques',
          'Les applications pratiques',
          'Les concepts avancés',
          'Toutes les réponses ci-dessus',
        ],
        correctAnswer: 'Toutes les réponses ci-dessus',
        explanation: 'En ' + subjectName + ', toutes ces notions sont fondamentales pour une compréhension complète.',
      },
      {
        id: 'q_2',
        type: 'multiple-choice',
        question: `Quel principe est important pour comprendre ${subjectName} ?`,
        options: [
          'La méthode scientifique',
          'La pratique régulière',
          'La compréhension des concepts',
          'Toutes les réponses',
        ],
        correctAnswer: 'Toutes les réponses',
        explanation: 'Tous ces principes sont essentiels pour maîtriser ' + subjectName + '.',
      },
      {
        id: 'q_3',
        type: 'multiple-choice',
        question: `Quelle approche est recommandée pour apprendre ${subjectName} ?`,
        options: [
          'Étudier la théorie uniquement',
          'Faire des exercices pratiques',
          'Combiner théorie et pratique',
          'Mémoriser sans comprendre',
        ],
        correctAnswer: 'Combiner théorie et pratique',
        explanation: 'L\'apprentissage efficace de ' + subjectName + ' nécessite une combinaison de théorie et de pratique.',
      },
      {
        id: 'q_4',
        type: 'open-ended',
        question: `Pourquoi est-il important d'étudier ${subjectName} ?`,
        correctAnswer: 'Étudier ' + subjectName + ' permet de développer une pensée critique, acquérir des connaissances essentielles, et résoudre des problèmes complexes dans ce domaine.',
        keywords: ['pensée critique', 'connaissances', 'problèmes', 'compétences'],
        explanation: 'L\'étude de ' + subjectName + ' développe plusieurs compétences fondamentales pour la compréhension du domaine.',
      },
      {
        id: 'q_5',
        type: 'open-ended',
        question: `Décrivez une méthode efficace pour apprendre ${subjectName}.`,
        correctAnswer: 'Une méthode efficace combine la lecture de la théorie, la pratique régulière d\'exercices, et l\'enseignement à d\'autres pour vérifier sa compréhension.',
        keywords: ['théorie', 'pratique', 'exercices', 'compréhension'],
        explanation: 'L\'apprentissage actif et varié améliore la rétention et la maîtrise de ' + subjectName + '.',
      },
    ],
  };
}
