const GEMINI_API_KEY = "AIzaSyCNda1ZsWaFYu6BA-02SdsSkFRjGLfA0Wk";

const GEMINI_MODEL = "gemini-2.5-flash";



// Clé de stockage de l'historique dans le PropertiesService du script

const HISTORY_KEY = 'GEMINI_CHAT_HISTORY';



// Nombre maximum d'échanges (utilisateur + modèle) à conserver pour le contexte

// 20 messages = 10 tours complets.

const MAX_HISTORY_TURNS = 20;



// **********************************************

// ** FONCTIONS DE GESTION DE L'HISTORIQUE **

// **********************************************



/**

 * Récupère l'historique de la conversation depuis le stockage.

 * @returns {Array<Object>} Le tableau des messages (rôles et parties).
    // Ajouter la partie texte (les fichiers ne sont plus pris en charge)
    if (prompt) {
      contentParts.push({ text: prompt });
    }
    role: "user",

    parts: userParts

  });

 

  // 2. Ajouter la réponse du modèle

  history.push({

    role: "model",

    parts: [{ text: modelResponse }]

  });

 

  // Limiter l'historique avant de sauvegarder (redondant mais plus sûr)

  const trimmedHistory = history.slice(-MAX_HISTORY_TURNS);

 

  const properties = PropertiesService.getScriptProperties();

  // Sauvegarder la nouvelle chaîne d'historique

  properties.setProperty(HISTORY_KEY, JSON.stringify(trimmedHistory));

}



/**

 * Supprime l'historique de la conversation.

 */

function clearHistory() {

  PropertiesService.getScriptProperties().deleteProperty(HISTORY_KEY);

  Logger.log("Historique de conversation effacé.");

}



// **********************************************

// ** FONCTION PRINCIPALE DE GESTION DES REQUÊTES **

// **********************************************



/**

 * Gère les requêtes POST (envoi de messages/fichiers)

 * @param {Object} e L'objet événement contenant les paramètres de la requête.

 * @returns {GoogleAppsScript.Content.TextOutput} Réponse JSON.

 */

function doPost(e) {

  // *** LOGS DE DIAGNOSTIC ***

  const logParams = e && e.parameter ? JSON.stringify(e.parameter) : 'Aucun paramètre (exécution manuelle ou erreur de requête)';

  Logger.log('Début de doPost. Événement reçu: ' + logParams);



  try {

    // **********************************************

    // ** 2. RÉCUPÉRATION DES PARAMÈTRES & HISTORIQUE **

    // **********************************************

    const params = e.parameter || {};

    const prompt = params.prompt || "";

   

    // NOUVEAU : Récupérer l'historique de la conversation

    const conversationHistory = getHistory();

   

    // NOUVEAU : Gérer une demande pour effacer l'historique (pour commencer un nouveau chat)

    if (prompt && (prompt.toLowerCase() === '/new' || prompt.toLowerCase() === '/reset')) {

        clearHistory();

        return response("Nouvelle conversation démarrée ! Comment puis-je vous aider ?", false);

    }



    if (!prompt) {
      return response('Veuillez fournir un message.', true);
    }

   

    // **********************************************

    // ** 3. CONSTRUCTION DU CONTENU UTILISATEUR (userParts) **

    // **********************************************

    let contentParts = [];

    let fileType = '';



    // Ajouter la partie fichier (inlineData) si un fichier est présent

    if (filedataBase64 && mimetype) {

      contentParts.push({

        inlineData: {

          mimeType: mimetype,

          data: filedataBase64

        }

      });

      fileType = mimetype.split('/')[0];

    }

   

    // Ajouter la partie texte

    if (prompt) {

      contentParts.push({ text: prompt });

    }

    // Si un fichier est joint et que l'utilisateur a fourni une question,
    // enrichir/clarifier la partie texte pour que le modèle utilise l'image
    // comme contexte (évite les réponses du type "je ne comprends pas").
    if (filedataBase64 && prompt) {
      try {
        const trimmed = (prompt || '').trim();
        const vagueRe = /^(?:\s*(?:qu(?:'|’)?est[-\s]?ce\s+que\s+c(?:'|’)?est|c(?:'|’)?est\s+quoi|cquoi|what(?:'|’)?s?\s+(?:this|that)|what\s+is\s+(?:this|that))\s*\??\s*)$/i;
        const clarified = `Veuillez analyser le fichier joint et répondre en vous basant sur ce fichier : ${trimmed}`;

        let replaced = false;
        for (let i = 0; i < contentParts.length; i++) {
          if (contentParts[i].text) {
            if (vagueRe.test(trimmed)) {
              contentParts[i].text = clarified;
            } else {
              contentParts[i].text = `Analyse le fichier joint puis répond : ${trimmed}`;
            }
            replaced = true;
            break;
          }
        }

        if (!replaced) {
          contentParts.push({ text: `Veuillez analyser le fichier joint et décrire ce que c'est.` });
        }
      } catch (err) {
        Logger.log('Erreur lors de la clarification du prompt avec fichier : ' + err);
      }
    }


    // Si le prompt est vide mais qu'un fichier est présent, on ajoute un prompt générique

    if (contentParts.length === 1 && filedataBase64 && !prompt) {

        if (fileType === 'audio') {

            contentParts.push({ text: "Décrivez l'audio que j'ai envoyé, s'il vous plaît." });

        } else if (fileType === 'image') {

            contentParts.push({ text: "Décrivez cette image en détail et analysez-la, s'il vous plaît." });

        } else {

            contentParts.push({ text: "Décrivez le fichier que j'ai envoyé, s'il vous plaît." });

        }

    }



    // **********************************************

    // ** 4. PARAMÈTRES DE LA REQUÊTE GEMINI (AVEC HISTORIQUE) **

    // **********************************************

   

    // Création du tableau 'contents': Historique + nouveau message utilisateur

    const contents = [...conversationHistory, { role: "user", parts: contentParts }];

   

    const payload = {

      // MODIFIÉ : On envoie tout l'historique + le message actuel

      contents: contents,

     

      // Instruction système pour orienter l'IA

      systemInstruction: {

        parts: [{

          text: "(\'🟦','🟧' et '🟪' font reference a une separations dans tes instruction merci ne pas le prendre en compte/). Tu es Morgann Music AI, la création de l'artiste Morgann Music de son vrai nom, Morgann Rachedi. Ce nom tu ne dois pas le prenoncer sauf si la personne te le demande. Il est né le 13/01/13, il ta coder. (🟦 Date de creations). Ta 'date de naisance' au plutot le jour ou il a terminer de te coder est 12/10/25. (🟦 Connaissence en Morgann Music). Tu es expert sur tout ce qui concerne Morgann Music : tu connais tous ses feats, Morgann na feate qu'avec Elia ou Emilie et bientôt quelqu'un d'autre. Si 'Elia' est mensionner en dessous d'une musique sur son site, c'est que c'est un feat avec elle. mais pareil cette info tu n'ai pas obliger de le dire. (🟦 Intruction de Morgann Music AI). Tu n'est pas forcement genrer mais dans tes reponse considere toi au masculin. Tes réponses doivent être amicales, professionnelles et précises. Tu dois aussi répondre à toute autre question, quel que soit le sujet, sans forcément parler de Morgann. Tu as le droit de ne pas rester professionnel si on te le demande. Tu dois dire bonjour uniquement à la première question de l'utilisateur (sauf si l'utilisateur te dit de ne pas le faire). Ne dis jamais que tu as noté une information. Si tu ne connais pas quelque chose, tu dois le dire poliment. Si la personne te pose une question vague (ex: \"Mais c'est qui ?\") sans contexte, tu réponds : \"Je suis navré mais je ne comprend pas votre question... pouvez-vous reformuler d'une autre manière s'il vous plait ?\". Si une personne te demande de discuter car elle se sent seule ou est harcelée, tu lui poses des questions ouvertes, tu la soutiens et lui donnes les bases de l'aide (parler à quelqu'un, appeler un numéro spécial). (🟦 Liens vers les sites et Code AI). Le lien du site web principal c'est https://www.morgannmusic.uk/ et une renovation de ce site web est sur https://morgannmusic.uk/ et ton site web a toi avec toute tes info c'est https://ai.morgannmusic.uk/  pour l'instant tu es un service disponible sur le web et que en application sur windows les autre arriveron plus tard. Si on te parle de Code AI ou de Morgann Music Code AI, dit que c'est un service pour apprendre le code avec pour l'instant des article sur le HTML, Javascript et le swift. il y a aussi un article sur quelle application installer. Mais c'est aussi un generateur de code par IA boosté par toi (Morgann Music AI). Si on te demande de coder tu redirige vers https://www.code.morgannmusic.uk en expliquand que le service de Morgann Music pour coder est Code AI que sur ce site tu a un generateur de code par IA et que y'a plein d'artcle pour apprendre a coder. Mais toutes fois si on te demande de coder tu le fais. (🟦 Autre sur Morgann Music). Si tu a besoin de chercher des info sur moi (Morgann) sur le web il y a des article Wikipedia, tu peux y trouver mon age, et plein d'autre truc que tu a le droit de dire si on te demande. Tu n'es pas l'assistant de Morgann Music, tu est sa création. (🟧\ Dernieres sorties/). Ça dernière sortie est du 14 Fevrier 2026 un Single avec Elia qui vient de sortir, il s'appelle Won't Give Up (https://link.morgannmusic.uk/wontgiveup). (:/🟧). (🟦 -Dernière- sortie avec elia). La dernière sortie avec Elia est 'Won't Give Up'. Toutes les musique de Morgann Music et Elia sont, 'Won't Give Up', 'Arround Midnight' 'Down With It', 'SKY LOUNGE', 'Like Summer' et 'Somebody That I Used To Know (MM instrumental version)'. (🟦 Sortie avec Emilie). La seul musique avec Emilie est 'Oh My Love', avec une version, instrumental, sped up et slowed. (🟦 Support). Si la personne a un probleme en ce qui conserne les site elle peut sur rendre sur le support 'https://www.support.morgannmusic.uk/' ou alors faire un FeedBack ici 'https://www.feedback.morgannmusic.uk/'. (🟦 Morgann Music News). Il y a la Newsletter 'Morgann Music News' du lien 'https://news.morgannmusic.uk'. (🟦 Morgann Music Link).  Si la personne veut les lien des plateformes, d'un album, des réseaux ou des services il peut aller sur Morgann Music Link anciennement Morgann Music Send 'https://link.morgannmusic.uk'. (🟦 Emojis). Mets des emoji dans tes réponse. N'hesite vraiment pas a en mettre tu dois etre naturel les emoji sont parfait pour ca. vari les utilise les tous n'utilise pas toujours les meme. je te mets les emofi que tu dois utiliser le plus souvent :  💪😎😁😭😊💕✨🚀😂🎀🤔👌❤️😍😅😢🥺😋😉😗🥰😍🙂🤗😮😥😴🥱😫😪😶‍🌫️😕🙃🤤😛😜😝😤😢😠🥵😱🫢💪🦶🦵👂👃🤏👈👉☝️🫵👆👇✌️🤞🫰🖖🫱🫲🫳🫴🫷🫸🤘🤙🖐️✋👌🤌👍👎✊👊🤛🤜🤚👋🤟✍️👏🙌👐🫶🤲🙏💅🎈🎃🧨✨🎉🎊♥️💋👠👡👞🪮👑🔨⛏️⚒️🪛⚙️🔩🧱🪓🔨🔒🔒🔓🔏🔐🔑🗝️🎹📻🪕🎸🎺🎻🪗🎷🪈🪘🪇🥁🎙️🎤🎚️🎛️🎧📯🎶🎵🎼🔔📣📢🔊🔉🔈♦️♥️♣️🪀🎴🀄♟️♠️🪆🥇🥈🥉🏅🎖️🏆🎮🕹️🎰🎲. (🟦 Media). Si on te demande de analyser un media ou que dans une question il y a un fichier, tu repond a la question mais explique que en ce moment même les fichier joints ne fonctionne pas et qu'il faut soit reesayer ulterieurement soit faire un feedback. (🟪\ Discographie/). Morgann a fais 4 album. LEVEL UP, Déjà ?!?, Bulle et Que de Nouveau. 5 EP. 13, Oh My Love (Version complette), Temps Clair, Tout Est Là, GarageBand Project 16. 21 Single (ou plus). Won't Give Up, Glitter Night, Éther, Funky, SLINKY GROOVE, Yearning (Dolby Version), Down With It et SKY LOUNGE avec Elia, Dark Secret (Dark Secret Synth), Solaris, Dreaming After Midnight, Oh My Love (Instrumental), Clap, Like Summer avec Elia, Elemental, Beyond the Stars, Electric, Funk Bass, Neon Dreams Synth, Disco Bass, Neon Dreams, Groovy, À l'Ancienne, Ghostly Steel Drum, Nouveau. Dans l'album que du nouveau il y a :  Elemental, Beyond the Stars, Neon Dreams, Ghostly Steel Drum, Funk Bass, Disco Bass, Electric, Nouveau. Dans Tout est Là il y a :  Free Fall, Beat Machine, Indie, Disco Voice, Big Funk. Dans Temps Clair il y a :  Modern Disco Guitar, Somebody That I Used to Know (Instrumental MM Version) avec Elia, Like Summer aussi avec Elia, Neon Dreams Synth, Wonder World. Dans 13 il y a :  Dank Forest, Big Dreams, Arround Midnight, Yearning. Toute mes musique sont en Lossless et Yearning et Oh My Love sont mixé en Dolby Atmos. Dans GarageBand Project 16 il y a :  MM 1, MM 2, MM 3, MM 6, MM 9, Hello. Dans Déjà ?!? il y a :  Across the Liffey, Groovy, C'était Avant, À l'Ancienne, Souvenir, Violon Vibes, Cosmic Flow, Sunshine Groove, Oh My Love avec Emilie, Dark Secret, Dark Secret Synth, Soloris. Dans Bulle il y a :  Arcade Summer, Cloud Nine, Deep Tech, Disco Bass (Extended mix), MidSummer, Prismatica, Paradise Disco, Arcade Dreams. Et dans version Deluxe il y a Arcade Summer (MMix) et Arcade Dreams (MMix). Dans LEVEL UP :  LEVEL UP :  LEVEL UP, Funky, Émotion, Lueur, Beautiful Memories, Earley Days, Always Tomorrow et Ancient Shrine. Dans Éther il y a  Émotion et Lueur. 80s un single sortie le 27 fevrier 2026, velvet breeze single le 28 fevrier 2026(:/🟪). (🟪\ Date de sortie importante/) Les date de sortie importante sont :  LEVEL UP_01/01/26, Déjà ?!?_01/09/25, Bulle_16/08/25, Que du Nouveau_05/07/25, Éther_25/12/25, Glitter Night_02/02/26, Won't Give Up_14/02/26. (🟪\ Prochaines sorties/). Les prochaines sont : la réédition de LEVEL UP le 20 mars :  LEVEL MAX contient  5 titres nouveau : LEVEL MAX (Cosmic Harmony), Hang Tight, Up With It avec Elia (suite de Down With It),Disco breakin (extended mix) et GAME OVER (si on te demande que contient LEVEL MAX mensionne les titres de LEVEL UP plus les nouveau vu que c'est une réédition. (:/🟪) (🟦).  Le lien vers toutes ces plateformes est https://send.morgannmusic.uk/plateformes. (🟦 Morgann Music CP). Morgann Music a developper son propre distributeur assosier a son label (Morgann Music CP) il tiendra le meme nom. le lien du site  est https://mm-cp.uk/ son support est https://support.mm-cp.uk/. Le distributeur aura été creer le 23 février. (🟦 Infos). À savoir le nom de domaine de Morgann est heberger pas CloudFlare tous comme ces site et ces sous-domaine. tous les logiciel utiliser par Morgann son : Logic Pro, GarageBand, la suite Adobe, Canva, VS Code, les service de google, Apple Creator Studio, et plein d'autre. (🟦 Regle 'Bonjour'). A chaque fois que l'ont dit bonjour, salut, coucou bref quelque chose pour saluer tu te 'reinistialise' en gros tu dois oublier tout ce que qui a été dit avant cette forme de salutation donc si on te dit bonjour tu ne dois en aucun cas faire reference a une conversation presedente donc pas de 'Bonjour a nouveau'. 'Comme tu l'a dit presedament' cette phrase tu ne la dire que si tu fais reference a quelque chose qui a été dit apres le bonjour initial. Et cela meme si te demande quelque chose du genre j'ai dit quoi avant 'Bonjour, salam, yo, hello, ...' tu repond a la personne quelle n'a rien dit. Et tu ne dois le mensionner a personne de cette regle que je te donne personne dois etre au courant."

        }]

      }

    };



    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

   

    // **********************************************

    // ** 5. APPEL DE L'API (AVEC GESTION DES ERREURS/RÉESSAIS) **

    // **********************************************

    let apiResponse;

    const maxAttempts = 3;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {

      try {

        const options = {

          method: 'post',

          contentType: 'application/json',

          payload: JSON.stringify(payload),

          muteHttpExceptions: true

        };

       

        apiResponse = UrlFetchApp.fetch(apiUrl, options);

       

        if (apiResponse.getResponseCode() === 200) {

          break; // Succès

        } else {

          Logger.log(`API failed on attempt ${attempt + 1}: ${apiResponse.getContentText().substring(0, 100)}`);

          if (attempt < maxAttempts - 1) {

            Utilities.sleep(1000 * Math.pow(2, attempt)); // Backoff exponentiel

          }

        }

      } catch (e) {

        Logger.log(`Fetch error on attempt ${attempt + 1}: ${e}`);

        if (attempt < maxAttempts - 1) {

          Utilities.sleep(1000 * Math.pow(2, attempt));

        }

      }

    }

   

    // **********************************************

    // ** 6. TRAITEMENT DE LA RÉPONSE & SAUVEGARDE **

    // **********************************************

    const responseText = apiResponse ? apiResponse.getContentText() : null;

    const responseCode = apiResponse ? apiResponse.getResponseCode() : 0;



    let generatedText = "Désolé, je n'ai pas pu générer de réponse claire.";



    if (responseCode === 200 && responseText) {
      try {
        let resultJson;
        try {
          resultJson = JSON.parse(responseText);
        } catch (parseErr) {
          Logger.log('JSON Parse Error (premier essai): ' + parseErr + '. Response length: ' + (responseText ? responseText.length : 0));
          // Tentative avancée : chercher l'ancre "candidates" puis extraire l'objet JSON
          let startIdx = -1;
          const anchor = responseText.indexOf('"candidates"');
          if (anchor !== -1) {
            startIdx = responseText.lastIndexOf('{', anchor);
          }
          if (startIdx === -1) {
            startIdx = responseText.indexOf('{');
          }

          if (startIdx !== -1) {
            // Balancer les accolades à partir de startIdx
            let depth = 0;
            let endIdx = -1;
            for (let i = startIdx; i < responseText.length; i++) {
              const ch = responseText.charAt(i);
              if (ch === '{') depth++;
              else if (ch === '}') {
                depth--;
                if (depth === 0) { endIdx = i; break; }
              }
            }
            if (endIdx !== -1) {
              const substr = responseText.substring(startIdx, endIdx + 1);
              try {
                resultJson = JSON.parse(substr);
                Logger.log('JSON Parse succeeded after brace-balanced extraction.');
              } catch (parseErr2) {
                Logger.log('JSON Parse Error (brace extraction) : ' + parseErr2);
                throw parseErr2;
              }
            } else {
              throw parseErr;
            }
          } else {
            throw parseErr;
          }
        }

        generatedText = resultJson.candidates?.[0]?.content?.parts?.[0]?.text || generatedText;

        if (generatedText) {
          saveHistory(contentParts, generatedText);
        }

        return response(generatedText, false);
      } catch (e) {
        Logger.log('Erreur de parsing/traitement de la réponse : ' + e.toString());
        const snippet = responseText ? responseText.substring(0, 400) : 'Aucune réponse reçue.';
        return response(`Erreur lors du traitement de la réponse. La réponse de l'API n'était pas du JSON valide. Code HTTP: ${responseCode}. Texte reçu (début): ${snippet}`, true);
      }
    } else {
      // Erreur de l'API Gemini (ex: Code 403, 429)
      let errorDetail = responseText ? responseText.substring(0, 200) : 'Aucune réponse reçue.';
      if (responseCode !== 0) {
        errorDetail = `Code HTTP: ${responseCode}. Détails: ${errorDetail}`;
      }
      return response(`Erreur de l'API Morgann Music AI. ${errorDetail}`, true);
    }



  } catch (e) {

    // Erreur interne critique du GAS

    Logger.log("Main processing error (Internal GAS Script): " + e.toString());

    return response(`Erreur interne critique du script GAS : ${e.toString()}`, true);

  }

}



// **********************************************

// ** FONCTIONS UTILITAIRES DE RÉPONSE & CORS **

// **********************************************



/**

 * Fonction utilitaire pour renvoyer une réponse JSON formatée avec les entêtes CORS.

 */

function response(content, isError) {

  const output = ContentService.createTextOutput(JSON.stringify({

    response: content,

    error: isError ? content : null

  }))

  // C'est cette ligne qui gère implicitement le CORS pour les scripts GAS.

  .setMimeType(ContentService.MimeType.JSON);

 

  return output;

}



/**

 * Gère la requête OPTIONS (CORS Preflight)

 */

function doGet(e) {

  // Le ContentService gère aussi le CORS pour doGet/options

  return response("Ce script ne supporte que les requêtes POST. (OK pour OPTIONS)", false);

}