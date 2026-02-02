/**
 * Handler pour la génération d'examens blancs avec Mistral AI
 * Supporte l'analyse d'images via Pixtral (modèle vision de Mistral)
 */

import { Request, Response } from 'express';
import { callMistralVisionAPI } from '../services/mistral';

interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
}

interface MockExam {
  title: string;
  subject: string;
  duration: number;
  difficulty: 'Facile' | 'Moyen' | 'Difficile';
  questions: Question[];
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
1. Crée 5 questions de type QCM (4 options chacune)
2. Les questions doivent être basées sur le contenu du texte
3. Varie la difficulté (2 faciles, 2 moyennes, 1 difficile)
4. Fournis une explication claire pour chaque réponse correcte

IMPORTANT: Réponds UNIQUEMENT avec un objet JSON valide dans ce format exact:
{
  "title": "Titre de l'examen",
  "subject": "${subject || 'Général'}",
  "duration": 60,
  "difficulty": "Moyen",
  "questions": [
    {
      "id": "1",
      "question": "Question ici?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option A",
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
1. Crée 8 questions de type QCM (4 options chacune)
2. Les questions doivent couvrir les concepts principaux de ${subject || 'la matière'}
3. Varie la difficulté (3 faciles, 3 moyennes, 2 difficiles)
4. Fournis une explication claire pour chaque réponse correcte
${hasImages ? '5. Base les questions sur le contenu que tu vois dans les images\n' : ''}

IMPORTANT: Réponds UNIQUEMENT avec un objet JSON valide dans ce format exact:
{
  "title": "Examen Blanc - ${subject || 'Général'}",
  "subject": "${subject || 'Général'}",
  "duration": 90,
  "difficulty": "Moyen",
  "questions": [
    {
      "id": "1",
      "question": "Question ici?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option A",
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
1. Crée 6 questions de type QCM (4 options chacune)
2. Les questions doivent couvrir les concepts de base de ${subject || 'la matière'}
3. Varie la difficulté (2 faciles, 3 moyennes, 1 difficile)
4. Fournis une explication claire pour chaque réponse correcte

IMPORTANT: Réponds UNIQUEMENT avec un objet JSON valide dans ce format exact:
{
  "title": "Examen Blanc - ${subject || 'Général'}",
  "subject": "${subject || 'Général'}",
  "duration": 60,
  "difficulty": "Moyen",
  "questions": [
    {
      "id": "1",
      "question": "Question ici?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option A",
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
      const questions: Question[] = parsed.questions.map((q: any, index: number) => ({
        id: (index + 1).toString(),
        question: q.question || 'Question non définie',
        options: Array.isArray(q.options) ? q.options : ['Option A', 'Option B', 'Option C', 'Option D'],
        correctAnswer: q.correctAnswer || q.options?.[0] || 'Option A',
        explanation: q.explanation || 'Pas d\'explication disponible',
      }));

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
        id: '1',
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
        id: '2',
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
        id: '3',
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
        id: '4',
        question: `Quel est un objectif clé de l'étude de ${subjectName} ?`,
        options: [
          'Développer une pensée critique',
          'Acquérir des connaissances factuelles',
          'Résoudre des problèmes complexes',
          'Toutes les réponses',
        ],
        correctAnswer: 'Toutes les réponses',
        explanation: 'L\'étude de ' + subjectName + ' vise à développer plusieurs compétences complémentaires.',
      },
      {
        id: '5',
        question: `Comment évaluer sa compréhension en ${subjectName} ?`,
        options: [
          'Relire ses notes',
          'Faire des exercices',
          'Expliquer à quelqu\'un d\'autre',
          'Toutes les méthodes',
        ],
        correctAnswer: 'Toutes les méthodes',
        explanation: 'Différentes méthodes d\'évaluation permettent une meilleure compréhension de ' + subjectName + '.',
      },
    ],
  };
}
