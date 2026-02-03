/**
 * Handler pour la génération d'examens blancs avec Mistral AI
 * Supporte l'analyse d'images via Pixtral (modèle vision de Mistral)
 */

import { Request, Response } from 'express';
import { callMistralVisionAPI } from '../services/mistral';

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
    const { question, userAnswer, correctAnswer, keywords } = req.body;
    const userId = (req as any).userId;

    console.log('[EvaluateAnswerHandler] Requête reçue');
    console.log('[EvaluateAnswerHandler] UserId:', userId);

    // Construire le prompt pour évaluer la réponse
    const prompt = `Tu es un correcteur expert et bienveillant.

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
 * Handler pour générer un examen blanc
 */
export async function generateExamHandler(req: Request, res: Response) {
  try {
    const { documents, text, subject } = req.body;
    const userId = (req as any).userId;

    console.log('[ExamHandler] Requête reçue');
    console.log('[ExamHandler] UserId:', userId);
    console.log('[ExamHandler] Subject:', subject);
    console.log('[ExamHandler] Documents:', documents?.length || 0);
    console.log('[ExamHandler] Text length:', text?.length || 0);

    // Construire le prompt pour Mistral
    let prompt = '';

    if (text) {
      // Génération à partir d'un texte
      prompt = buildPromptFromText(text, subject);
    } else if (documents && documents.length > 0) {
      // Génération à partir de documents
      prompt = buildPromptFromDocuments(documents, subject);
    } else {
      // Génération générique
      prompt = buildGenericPrompt(subject);
    }

    console.log('[ExamHandler] Prompt construit:', prompt.substring(0, 200) + '...');

    // Vérifier si on a des images à analyser
    const hasImages = documents && documents.some((doc: any) => doc.type === 'image' && doc.content);

    // Construire le message pour Mistral
    let mistralMessage: any;
    if (hasImages) {
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

    // Parser la réponse de Mistral
    const exam = parseExamFromResponse(mistralResponse.content, subject);

    console.log('[ExamHandler] Examen parsé:', {
      title: exam.title,
      questions: exam.questions.length,
    });

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
function buildPromptFromText(text: string, subject?: string): string {
  return `Tu es un professeur expert qui crée des examens de qualité.

À partir du texte suivant, crée un examen blanc de ${subject || 'niveau général'}.

TEXTE:
${text}

INSTRUCTIONS:
1. Crée 12 questions au total :
   - 6 questions QCM (4 options chacune)
   - 6 questions à réponse ouverte (l'étudiant doit écrire sa réponse)
2. Les questions doivent être basées sur le contenu du texte
3. Varie la difficulté (4 faciles, 5 moyennes, 3 difficiles)
4. Pour les QCM : fournis une explication claire pour chaque réponse correcte
5. Pour les questions ouvertes : fournis la réponse attendue ET des mots-clés importants

IMPORTANT: Réponds UNIQUEMENT avec un objet JSON valide dans ce format exact:
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
function buildPromptFromDocuments(documents: any[], subject?: string): string {
  const hasImages = documents.some((doc: any) => doc.type === 'image' && doc.content);
  const docNames = documents.map(d => d.name).join(', ');

  let prompt = `Tu es un professeur expert qui crée des examens de qualité.\n\n`;

  if (hasImages) {
    prompt += `Analyse attentivement les images fournies qui contiennent des exercices, examens ou cours.\n`;
    prompt += `Extrait le contenu textuel des images (formules, questions, théorèmes, etc.).\n\n`;
  } else {
    prompt += `À partir des documents suivants: ${docNames}\n\n`;
  }

  prompt += `Crée un examen blanc de ${subject || 'niveau général'}.\n\n`;

  prompt += `INSTRUCTIONS:
1. Crée 15 questions au total :
   - 8 questions QCM (4 options chacune)
   - 7 questions à réponse ouverte (l'étudiant doit écrire sa réponse)
2. Les questions doivent couvrir les concepts principaux de ${subject || 'la matière'}
3. Varie la difficulté (5 faciles, 6 moyennes, 4 difficiles)
4. Pour les QCM : fournis une explication claire pour chaque réponse correcte
5. Pour les questions ouvertes : fournis la réponse attendue ET des mots-clés importants
${hasImages ? '6. Base les questions sur le contenu que tu vois dans les images\n' : ''}

IMPORTANT: Réponds UNIQUEMENT avec un objet JSON valide dans ce format exact:
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
function buildGenericPrompt(subject?: string): string {
  return `Tu es un professeur expert qui crée des examens de qualité.

Crée un examen blanc de ${subject || 'niveau général'} avec des questions fondamentales.

INSTRUCTIONS:
1. Crée 10 questions au total :
   - 5 questions QCM (4 options chacune)
   - 5 questions à réponse ouverte (l'étudiant doit écrire sa réponse)
2. Les questions doivent couvrir les concepts de base de ${subject || 'la matière'}
3. Varie la difficulté (3 faciles, 5 moyennes, 2 difficiles)
4. Pour les QCM : fournis une explication claire pour chaque réponse correcte
5. Pour les questions ouvertes : fournis la réponse attendue ET des mots-clés importants

IMPORTANT: Réponds UNIQUEMENT avec un objet JSON valide dans ce format exact:
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
 * Parse la réponse de Mistral pour extraire l'examen
 */
function parseExamFromResponse(content: string, subject?: string): MockExam {
  try {
    // Essayer de trouver le JSON dans la réponse
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);

      // Valider et nettoyer les données
      const questions: Question[] = parsed.questions.map((q: any, index: number) => {
        const questionType = q.type || 'multiple-choice';

        if (questionType === 'open-ended') {
          return {
            id: `q_${index + 1}`,
            type: 'open-ended' as const,
            question: q.question || 'Question non définie',
            correctAnswer: q.correctAnswer || 'Réponse non définie',
            keywords: Array.isArray(q.keywords) ? q.keywords : [],
            explanation: q.explanation || 'Pas d\'explication disponible',
          };
        } else {
          const options = Array.isArray(q.options) ? q.options : ['Option A', 'Option B', 'Option C', 'Option D'];

          // Normaliser correctAnswer pour qu'il corresponde exactement à une option
          let correctAnswer = q.correctAnswer || options[0];

          // Si correctAnswer ne correspond pas exactement à une option, trouver la plus proche
          if (!options.includes(correctAnswer)) {
            // Normaliser et comparer (sans casse, sans espaces superflus)
            const normalizedAnswer = correctAnswer.toLowerCase().trim();
            const matchingOption = options.find(opt =>
              opt.toLowerCase().trim() === normalizedAnswer
            );
            correctAnswer = matchingOption || options[0];
          }

          return {
            id: `q_${index + 1}`,
            type: 'multiple-choice' as const,
            question: q.question || 'Question non définie',
            options: options,
            correctAnswer: correctAnswer,
            explanation: q.explanation || 'Pas d\'explication disponible',
          };
        }
      });

      return {
        title: parsed.title || `Examen Blanc - ${subject || 'Général'}`,
        subject: parsed.subject || subject || 'Général',
        duration: parsed.duration || 60,
        difficulty: parsed.difficulty || 'Moyen',
        questions: questions,
      };
    }

    throw new Error('Pas de JSON trouvé dans la réponse');
  } catch (error) {
    console.error('[ExamHandler] Erreur parsing:', error);
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
