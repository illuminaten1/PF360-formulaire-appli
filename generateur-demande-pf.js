// Configuration
const LOCALSTORAGE_KEY = 'demandePF_draft';
const AUTOSAVE_DELAY = 2000; // 2 secondes
const MAILTO_MAX_LENGTH = 10000; // Limite compatible avec la plupart des navigateurs

// Limites de longueur pour les champs du formulaire
const MAX_LENGTH = {
    NAME: 100,           // Nom, prénom, commune
    TEXT: 255,           // Adresses, unité
    EMAIL: 254,          // Emails
    PHONE: 20,           // Téléphones
    NIGEND: 6,           // NIGEND
    POSTAL_CODE: 5,      // Code postal
    LONG_TEXT: 2000,     // Blessures, qualifications pénales
    RESUME: 5000         // Résumé de la situation
};

// Éléments du DOM
let form, telPro, telPerso, emailPro, emailPerso, emailAutoriteHierarchique;
let codePostal, nigend, nom, prenom, errorMessage;
let signatureNomPrenom, signatureDate; // Champs de signature
let autosaveTimeout;
let lastFocusedElement; // Pour la gestion du focus des modales
let pendingMailtoData = null; // Pour stocker les données du mailto en attente de confirmation

// Initialisation au chargement du DOM
document.addEventListener('DOMContentLoaded', function() {
    console.log('Générateur PF: JavaScript chargé et initialisé');

    // Initialiser une clé de session sécurisée
    initializeSessionKey();

    // Supprimer le hash #rgpdModal de l'URL pour éviter la réouverture automatique du modal
    if (window.location.hash === '#rgpdModal') {
        history.replaceState(null, null, ' ');
    }

    if (!initializeElements()) {
        console.error('Générateur PF: Impossible d\'initialiser les éléments');
        return;
    }

    setupEventListeners();
    setupRgpdModalCleanup();
    setupInfoEnvoiModalCleanup();
    applyMaxLengthAttributes();
    loadDraft();
    // Réinitialiser l'état des champs partie civile après le chargement du brouillon
    togglePartieCivileFields();
    showDraftNotification();
});

// Initialiser une clé de session sécurisée pour le chiffrement
function initializeSessionKey() {
    if (!sessionStorage.getItem('sessionId')) {
        // Générer un UUID sécurisé pour cette session
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            sessionStorage.setItem('sessionId', crypto.randomUUID());
        } else {
            // Fallback pour les anciens navigateurs
            const fallbackUUID = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
            sessionStorage.setItem('sessionId', fallbackUUID);
        }
        console.log('Générateur PF: Nouvelle clé de session générée');
    }
}

// Initialiser les références aux éléments DOM
function initializeElements() {
    form = document.getElementById('demandeForm');

    if (!form) {
        console.error('Générateur PF: Formulaire #demandeForm non trouvé !');
        return false;
    }

    telPro = document.getElementById('telPro');
    telPerso = document.getElementById('telPerso');
    emailPro = document.getElementById('emailPro');
    emailPerso = document.getElementById('emailPerso');
    emailAutoriteHierarchique = document.getElementById('emailAutoriteHierarchique');
    codePostal = document.getElementById('codePostal');
    nigend = document.getElementById('nigend');
    nom = document.getElementById('nom');
    prenom = document.getElementById('prenom');
    errorMessage = document.getElementById('errorMessage');
    signatureNomPrenom = document.getElementById('signatureNomPrenom');
    signatureDate = document.getElementById('signatureDate');

    // Initialiser la date de signature
    updateSignatureDate();

    console.log('Générateur PF: Tous les éléments DOM initialisés');
    return true;
}

// Appliquer les attributs maxlength depuis les constantes
function applyMaxLengthAttributes() {
    // Champs NAME (100 caractères)
    const nameFields = ['nom', 'prenom', 'commune', 'signatureNomPrenom'];
    nameFields.forEach(id => {
        const field = document.getElementById(id);
        if (field) field.maxLength = MAX_LENGTH.NAME;
    });

    // Champs TEXT (255 caractères)
    const textFields = ['unite'];
    textFields.forEach(id => {
        const field = document.getElementById(id);
        if (field) field.maxLength = MAX_LENGTH.TEXT;
    });

    // Champs EMAIL (254 caractères)
    const emailFields = ['emailPro', 'emailPerso', 'emailAutoriteHierarchique'];
    emailFields.forEach(id => {
        const field = document.getElementById(id);
        if (field) field.maxLength = MAX_LENGTH.EMAIL;
    });

    // Champs PHONE (20 caractères)
    const phoneFields = ['telPro', 'telPerso'];
    phoneFields.forEach(id => {
        const field = document.getElementById(id);
        if (field) field.maxLength = MAX_LENGTH.PHONE;
    });

    // Champs spécifiques
    if (nigend) nigend.maxLength = MAX_LENGTH.NIGEND;
    if (codePostal) codePostal.maxLength = MAX_LENGTH.POSTAL_CODE;

    // Champs LONG_TEXT (2000 caractères)
    const longTextFields = ['blessures', 'qualificationsPenales'];
    longTextFields.forEach(id => {
        const field = document.getElementById(id);
        if (field) field.maxLength = MAX_LENGTH.LONG_TEXT;
    });

    // Champ RESUME (5000 caractères)
    const resume = document.getElementById('resume');
    if (resume) resume.maxLength = MAX_LENGTH.RESUME;

    console.log('Générateur PF: Attributs maxLength appliqués depuis les constantes');
}

// Configuration des écouteurs d'événements
function setupEventListeners() {
    // Validation en temps réel
    nom.addEventListener('input', function(e) {
        e.target.value = e.target.value.toUpperCase();
        validateNom();
        scheduleSaveDraft();
    });
    nom.addEventListener('blur', function(e) {
        e.target.value = e.target.value.toUpperCase();
        validateNom();
    });

    const commune = document.getElementById('commune');
    commune.addEventListener('input', function(e) {
        e.target.value = e.target.value.toUpperCase();
        validateCommune();
        scheduleSaveDraft();
    });
    commune.addEventListener('blur', validateCommune);

    const unite = document.getElementById('unite');
    unite.addEventListener('input', function(e) {
        e.target.value = e.target.value.toUpperCase();
        validateUnite();
        scheduleSaveDraft();
    });
    unite.addEventListener('blur', validateUnite);

    prenom.addEventListener('input', function() {
        validatePrenom();
        scheduleSaveDraft();
    });
    prenom.addEventListener('blur', validatePrenom);

    // Validation du champ signature Nom Prénom
    signatureNomPrenom.addEventListener('input', function() {
        validateSignatureNomPrenom();
        scheduleSaveDraft();
    });
    signatureNomPrenom.addEventListener('blur', validateSignatureNomPrenom);

    telPro.addEventListener('input', function() {
        validatePhones();
        scheduleSaveDraft();
    });
    telPerso.addEventListener('input', function() {
        validatePhones();
        scheduleSaveDraft();
    });

    emailPro.addEventListener('input', function(e) {
        e.target.value = e.target.value.toLowerCase();
        validateEmails();
        scheduleSaveDraft();
    });
    emailPerso.addEventListener('input', function(e) {
        e.target.value = e.target.value.toLowerCase();
        validateEmails();
        scheduleSaveDraft();
    });

    emailAutoriteHierarchique.addEventListener('input', function(e) {
        e.target.value = e.target.value.toLowerCase();
        validateEmailAutoriteHierarchique();
        scheduleSaveDraft();
    });
    emailAutoriteHierarchique.addEventListener('blur', validateEmailAutoriteHierarchique);

    codePostal.addEventListener('input', function() {
        validateCodePostal();
        scheduleSaveDraft();
    });
    codePostal.addEventListener('blur', validateCodePostal);

    nigend.addEventListener('input', function() {
        validateNigend();
        scheduleSaveDraft();
    });
    nigend.addEventListener('blur', validateNigend);

    // Validation des selects
    const selectIds = ['type', 'grade', 'statutDemandeur', 'branche', 'formationAdministrative',
                       'departement', 'position', 'contexteMissionnel', 'qualificationInfraction'];
    selectIds.forEach(selectId => {
        const selectElement = document.getElementById(selectId);
        if (selectElement) {
            selectElement.addEventListener('change', function() {
                validateSelect(selectId);
                scheduleSaveDraft();
            });
        }
    });

    // Validation de la date des faits
    const dateFaits = document.getElementById('dateFaits');
    if (dateFaits) {
        dateFaits.addEventListener('change', function() {
            validateDateFaits();
            scheduleSaveDraft();
        });
        dateFaits.addEventListener('blur', validateDateFaits);
    }

    // Validation du montant des dommages
    const montantDommages = document.getElementById('montantDommages');
    if (montantDommages) {
        montantDommages.addEventListener('input', function() {
            validateMontantDommages();
            scheduleSaveDraft();
        });
        montantDommages.addEventListener('blur', validateMontantDommages);
    }

    // Validation de la date d'audience
    const dateAudienceDate = document.getElementById('dateAudienceDate');
    const dateAudienceTime = document.getElementById('dateAudienceTime');
    if (dateAudienceDate) {
        dateAudienceDate.addEventListener('change', function() {
            validateDateAudience();
            scheduleSaveDraft();
        });
        dateAudienceDate.addEventListener('blur', validateDateAudience);
    }
    if (dateAudienceTime) {
        dateAudienceTime.addEventListener('change', scheduleSaveDraft);
    }

    // Gestion de la constitution de partie civile
    const partieCivile = document.getElementById('partieCivile');
    if (partieCivile) {
        partieCivile.addEventListener('change', function() {
            togglePartieCivileFields();
            scheduleSaveDraft();
        });
        // Initialiser l'état des champs au chargement
        togglePartieCivileFields();
    }

    // Compteurs de caractères pour les champs texte longs
    setupCharacterCounters();

    // Appliquer le trim à tous les champs
    applyTrimToAllFields();

    // Gérer les champs readonly (pour contourner l'autocomplétion)
    setupReadonlyFields();

    // Gestion de la soumission et du reset
    form.addEventListener('submit', handleFormSubmit);
    form.addEventListener('reset', handleFormReset);

    // Gestion du modal d'information avant envoi
    const confirmEnvoiBtn = document.getElementById('confirmEnvoiBtn');
    if (confirmEnvoiBtn) {
        confirmEnvoiBtn.addEventListener('click', function() {
            console.log('Générateur PF: Confirmation de l\'envoi par l\'utilisateur');
            // Fermer le modal
            const modal = document.getElementById('infoEnvoiModal');
            if (modal) {
                modal.setAttribute('data-fr-opened', 'false');
                modal.close();
            }
            // Procéder à l'envoi
            proceedWithMailSending();
        });
    }

    // Autosave sur tous les champs
    form.addEventListener('input', scheduleSaveDraft);
    form.addEventListener('change', scheduleSaveDraft);
}

// Nettoyer le hash de l'URL quand le modal RGPD se ferme
function setupRgpdModalCleanup() {
    const rgpdModal = document.getElementById('rgpdModal');

    if (!rgpdModal) {
        console.warn('Générateur PF: Modal RGPD non trouvé');
        return;
    }

    // Gérer l'ouverture du modal (stocke le focus)
    rgpdModal.addEventListener('dsfr.disclose', function() {
        lastFocusedElement = document.activeElement;
        // Le DSFR gère déjà le focus sur le modal
    });

    // Écouter les événements de fermeture du modal DSFR
    rgpdModal.addEventListener('dsfr.conceal', function() {
        // Supprimer le hash de l'URL sans recharger la page
        if (window.location.hash === '#rgpdModal') {
            history.replaceState(null, null, ' ');
        }
        // Restaurer le focus sur l'élément qui a ouvert le modal
        if (lastFocusedElement) {
            lastFocusedElement.focus();
            lastFocusedElement = null;
        }
    });

    // Alternative : écouter les clics sur les boutons de fermeture
    const closeButtons = rgpdModal.querySelectorAll('[aria-controls="rgpdModal"]');
    closeButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Petit délai pour laisser le DSFR fermer le modal
            setTimeout(() => {
                if (window.location.hash === '#rgpdModal') {
                    history.replaceState(null, null, ' ');
                }
            }, 100);
        });
    });
}

// Gérer le modal d'information avant envoi
function setupInfoEnvoiModalCleanup() {
    const infoEnvoiModal = document.getElementById('infoEnvoiModal');

    if (!infoEnvoiModal) {
        console.warn('Générateur PF: Modal infoEnvoiModal non trouvé');
        return;
    }

    // Écouter les événements de fermeture du modal DSFR
    infoEnvoiModal.addEventListener('dsfr.conceal', function() {
        console.log('Générateur PF: Événement dsfr.conceal détecté');
        // Restaurer le focus sur l'élément qui a ouvert le modal
        if (lastFocusedElement) {
            lastFocusedElement.focus();
            lastFocusedElement = null;
        }
        // Note: pendingMailtoData sera réinitialisé par proceedWithMailSending()
        // ou restera null si l'utilisateur annule (ce qui est acceptable)
    });
}

// ============ VALIDATION ============

// ============ UTILITAIRES UNICODE ============

// Normalise Unicode (NFC) et mappe variantes typographiques vers ASCII
function normalizeUnicode(text) {
    if (!text) return text;

    // Normalisation NFC : é (U+00E9) = e + ́ (U+0065+U+0301)
    let normalized = text.normalize('NFC');

    // Mapper variantes : apostrophes typographiques → ', guillemets → ", tirets → -
    const replacements = {
        '\u2018': "'", // ' Left single quotation mark
        '\u2019': "'", // ' Right single quotation mark
        '\u201B': "'", // ‛ Single high-reversed-9 quotation mark
        '\u201A': "'", // ‚ Single low-9 quotation mark
        '\u2032': "'", // ′ Prime
        '\u201C': '"', // " Left double quotation mark
        '\u201D': '"', // " Right double quotation mark
        '\u201E': '"', // „ Double low-9 quotation mark
        '\u2033': '"', // ″ Double prime
        '\u2013': '-', // – En dash
        '\u2014': '-', // — Em dash
        '\u2011': '-', // ‑ Non-breaking hyphen
        '\u2212': '-', // − Minus sign
        '\u00A0': ' ', // Non-breaking space
        '\u2009': ' ', // Thin space
        '\u202F': ' '  // Narrow no-break space
    };

    for (const [from, to] of Object.entries(replacements)) {
        normalized = normalized.replace(new RegExp(from, 'g'), to);
    }

    return normalized;
}

// Wrapper : trim + normalise
function prepareForValidation(text) {
    if (!text) return '';
    return normalizeUnicode(text.trim());
}

// ============ FIN UTILITAIRES UNICODE ============

// Fonction utilitaire pour gérer les états visuels DSFR des champs
function setFieldState(fieldId, state, message = '') {
    const group = document.getElementById(fieldId + 'Group');
    const errorElement = document.getElementById(fieldId + 'Error');
    const successElement = document.getElementById(fieldId + 'Success');
    const field = document.getElementById(fieldId);

    if (!group || !errorElement || !successElement || !field) {
        console.warn(`Éléments DSFR non trouvés pour le champ: ${fieldId}`);
        return;
    }

    // Déterminer si c'est un select ou un input
    const isSelect = field.tagName === 'SELECT';
    const groupErrorClass = isSelect ? 'fr-select-group--error' : 'fr-input-group--error';
    const groupValidClass = isSelect ? 'fr-select-group--valid' : 'fr-input-group--valid';
    const fieldErrorClass = isSelect ? 'fr-select--error' : 'fr-input--error';
    const fieldValidClass = isSelect ? 'fr-select--valid' : 'fr-input--valid';

    // Réinitialiser les états
    group.classList.remove('fr-input-group--error', 'fr-input-group--valid', 'fr-select-group--error', 'fr-select-group--valid');
    field.classList.remove('fr-input--error', 'fr-input--valid', 'fr-select--error', 'fr-select--valid');
    errorElement.style.display = 'none';
    successElement.style.display = 'none';
    errorElement.textContent = '';

    // Appliquer le nouvel état
    if (state === 'error') {
        group.classList.add(groupErrorClass);
        field.classList.add(fieldErrorClass);
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    } else if (state === 'success') {
        group.classList.add(groupValidClass);
        field.classList.add(fieldValidClass);
        successElement.style.display = 'block';
    }
    // Si state === 'neutral' ou autre, tout est réinitialisé (pas d'état visuel)
}

// Fonction générique pour valider les champs nom et prénom
function validateName(field, fieldName, fieldId) {
    const rawValue = field.value.trim();

    if (!rawValue) {
        setFieldState(fieldId, 'neutral');
        return true;
    }

    // Normaliser avant validation
    const value = prepareForValidation(rawValue);

    if (value.length < 1) {
        setFieldState(fieldId, 'error', `Le ${fieldName} doit contenir au moins 1 caractère`);
        return false;
    }

    if (value.length > MAX_LENGTH.NAME) {
        setFieldState(fieldId, 'error', `Le ${fieldName} ne peut pas dépasser ${MAX_LENGTH.NAME} caractères`);
        return false;
    }

    // Accepter toutes les lettres Unicode (\p{L}), espaces, apostrophes, tirets
    const allowedCharsRegex = /^[\p{L}\s'\-]+$/u;
    if (!allowedCharsRegex.test(value)) {
        setFieldState(fieldId, 'error', `Le ${fieldName} contient des caractères non autorisés`);
        return false;
    }

    // Protection contre abus : 4+ caractères identiques consécutifs
    const consecutiveRegex = /(.)\1{3,}/;
    if (consecutiveRegex.test(value)) {
        setFieldState(fieldId, 'error', `Le ${fieldName} ne peut pas contenir 4 caractères identiques consécutifs`);
        return false;
    }

    setFieldState(fieldId, 'success');
    return true;
}

// Fonctions de validation spécifiques utilisant la fonction générique
function validateNom() {
    return validateName(nom, 'nom', 'nom');
}

function validatePrenom() {
    return validateName(prenom, 'prénom', 'prenom');
}

function validateSignatureNomPrenom() {
    if (!signatureNomPrenom) return true;

    const rawValue = signatureNomPrenom.value.trim();

    // Champ obligatoire
    if (rawValue === '') {
        setFieldState('signatureNomPrenom', 'error', 'Le prénom et nom sont requis');
        return false;
    }

    // Normaliser avant validation
    const value = prepareForValidation(rawValue);

    // Longueur minimale
    if (value.length < 2) {
        setFieldState('signatureNomPrenom', 'error', 'Le prénom et nom doivent contenir au moins 2 caractères');
        return false;
    }

    // Longueur maximale
    if (value.length > MAX_LENGTH.NAME) {
        setFieldState('signatureNomPrenom', 'error', `Le prénom et nom ne peuvent pas dépasser ${MAX_LENGTH.NAME} caractères`);
        return false;
    }

    // Accepter toutes les lettres Unicode (\p{L}), espaces, apostrophes, tirets
    const allowedCharsRegex = /^[\p{L}\s'\-]+$/u;
    if (!allowedCharsRegex.test(value)) {
        setFieldState('signatureNomPrenom', 'error', 'Le prénom et nom contiennent des caractères non autorisés');
        return false;
    }

    // Protection contre abus : 4+ caractères identiques consécutifs
    const consecutiveRegex = /(.)\1{3,}/;
    if (consecutiveRegex.test(value)) {
        setFieldState('signatureNomPrenom', 'error', 'Le prénom et nom ne peuvent pas contenir 4 caractères identiques consécutifs');
        return false;
    }

    setFieldState('signatureNomPrenom', 'success');
    return true;
}

function isValidPhoneFormat(phone) {
    if (!phone) return true;

    // Nettoyer : supprimer espaces, points, tirets, parenthèses
    let cleanPhone = phone.replace(/[\s.\-()]/g, '');

    // Gérer le préfixe +
    let hasPlus = cleanPhone.startsWith('+');
    if (hasPlus) {
        cleanPhone = cleanPhone.substring(1);
    }

    // Vérifier que seuls des chiffres restent
    if (!/^\d+$/.test(cleanPhone)) {
        return false;
    }

    // Normaliser : convertir +33/0033 → 0 pour validation
    // Gérer 0033 en premier (avant 33) car "0033..." commence par "0", pas par "33"
    if (cleanPhone.length === 13 && cleanPhone.startsWith('0033')) {
        // Format 0033 avec le 0 : 0033612345678 → 0612345678
        cleanPhone = '0' + cleanPhone.substring(4);
    } else if (cleanPhone.startsWith('33') && cleanPhone.length === 11) {
        // Format +33 sans le 0 : 33612345678 → 0612345678
        cleanPhone = '0' + cleanPhone.substring(2);
    }

    // === VALIDATION STRICTE FRANCE ET TERRITOIRES ===

    // Format France métropole et DOM : exactement 10 chiffres commençant par 0
    if (cleanPhone.startsWith('0')) {
        return cleanPhone.length === 10;
    }

    // Format France international : exactement 11 chiffres commençant par 33
    if (cleanPhone.startsWith('33')) {
        return cleanPhone.length === 11;
    }

    // Format COM (Nouvelle-Calédonie, Polynésie, Wallis-et-Futuna, Saint-Pierre-et-Miquelon)
    // 6 chiffres (local) ou 9 chiffres (international avec indicatif)
    if (cleanPhone.startsWith('687') || cleanPhone.startsWith('689') ||
        cleanPhone.startsWith('681') || cleanPhone.startsWith('508')) {
        return cleanPhone.length === 6 || cleanPhone.length === 9;
    }

    // === VALIDATION PERMISSIVE INTERNATIONALE ===
    // Accepter tout format international : 7 à 15 chiffres
    // Exemples : +1 213 555-0123 (USA), +44 20 7946 0958 (UK), +81 3-1234-5678 (Japon)
    return cleanPhone.length >= 7 && cleanPhone.length <= 15;
}

function validatePhones() {
    const telProValue = telPro.value.trim();
    const telPersoValue = telPerso.value.trim();
    let allValid = true;

    if (!telProValue && !telPersoValue) {
        setFieldState('telPro', 'error', 'Au moins un numéro de téléphone est requis');
        setFieldState('telPerso', 'neutral');
        return false;
    }

    // Validation du téléphone professionnel
    if (telProValue) {
        if (!isValidPhoneFormat(telProValue)) {
            setFieldState('telPro', 'error', 'Format invalide (ex: 0612345678 ou 687234234)');
            allValid = false;
        } else {
            setFieldState('telPro', 'success');
        }
    } else {
        setFieldState('telPro', 'neutral');
    }

    // Validation du téléphone personnel
    if (telPersoValue) {
        if (!isValidPhoneFormat(telPersoValue)) {
            setFieldState('telPerso', 'error', 'Format invalide (ex: 0612345678 ou 687234234)');
            allValid = false;
        } else {
            // Vérifier que les deux numéros sont différents s'ils sont tous les deux remplis
            if (telProValue && telPersoValue) {
                const cleanTelPro = telProValue.replace(/[\s.\-+]/g, '');
                const cleanTelPerso = telPersoValue.replace(/[\s.\-+]/g, '');

                if (cleanTelPro === cleanTelPerso) {
                    setFieldState('telPerso', 'error', 'Les numéros professionnel et personnel doivent être différents');
                    allValid = false;
                } else {
                    setFieldState('telPerso', 'success');
                }
            } else {
                setFieldState('telPerso', 'success');
            }
        }
    } else {
        setFieldState('telPerso', 'neutral');
    }

    return allValid;
}

function isValidEmailFormat(email) {
    if (!email) return true;

    const emailRegex = /^[a-zA-Z0-9]([a-zA-Z0-9._+-]*[a-zA-Z0-9])?@[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
}

function validateEmails() {
    const emailProValue = emailPro.value.trim();
    const emailPersoValue = emailPerso.value.trim();
    let allValid = true;

    if (!emailProValue && !emailPersoValue) {
        setFieldState('emailPro', 'error', 'Au moins une adresse email est requise');
        setFieldState('emailPerso', 'neutral');
        return false;
    }

    // Validation de l'email professionnel
    if (emailProValue) {
        if (!isValidEmailFormat(emailProValue)) {
            setFieldState('emailPro', 'error', 'Format d\'email invalide');
            allValid = false;
        } else {
            setFieldState('emailPro', 'success');
        }
    } else {
        setFieldState('emailPro', 'neutral');
    }

    // Validation de l'email personnel
    if (emailPersoValue) {
        if (!isValidEmailFormat(emailPersoValue)) {
            setFieldState('emailPerso', 'error', 'Format d\'email invalide');
            allValid = false;
        } else {
            // Vérifier que les deux emails sont différents s'ils sont tous les deux remplis
            if (emailProValue && emailPersoValue) {
                if (emailProValue.toLowerCase() === emailPersoValue.toLowerCase()) {
                    setFieldState('emailPerso', 'error', 'Les adresses email professionnelle et personnelle doivent être différentes');
                    allValid = false;
                } else {
                    setFieldState('emailPerso', 'success');
                }
            } else {
                setFieldState('emailPerso', 'success');
            }
        }
    } else {
        setFieldState('emailPerso', 'neutral');
    }

    return allValid;
}

function validateEmailAutoriteHierarchique() {
    const value = emailAutoriteHierarchique.value.trim();

    if (!value) {
        setFieldState('emailAutoriteHierarchique', 'neutral');
        return true;
    }

    if (!isValidEmailFormat(value)) {
        setFieldState('emailAutoriteHierarchique', 'error', 'Format d\'email invalide');
        return false;
    }

    setFieldState('emailAutoriteHierarchique', 'success');
    return true;
}

function validateCodePostal() {
    const value = codePostal.value.trim();

    if (!value) {
        setFieldState('codePostal', 'neutral');
        return true;
    }

    const codePostalRegex = /^((0[1-9]|[1-8][0-9]|9[0-5])[0-9]{3}|97[1-8][0-9]{2}|98[6-8][0-9]{2})$/;

    if (!codePostalRegex.test(value)) {
        setFieldState('codePostal', 'error', 'Code postal invalide (métropole ou DOM-TOM uniquement)');
        return false;
    }

    setFieldState('codePostal', 'success');
    return true;
}

function validateNigend() {
    const value = nigend.value.trim();

    if (!value) {
        setFieldState('nigend', 'neutral');
        return true;
    }

    const digitRegex = /^[0-9]+$/;
    if (!digitRegex.test(value)) {
        setFieldState('nigend', 'error', 'Le NIGEND ne doit contenir que des chiffres');
        return false;
    }

    if (value.length < 5 || value.length > 6) {
        setFieldState('nigend', 'error', 'Le NIGEND doit contenir entre 5 et 6 chiffres');
        return false;
    }

    setFieldState('nigend', 'success');
    return true;
}

function validateUnite() {
    const unite = document.getElementById('unite');
    const rawValue = unite.value.trim();

    if (!rawValue) {
        setFieldState('unite', 'neutral');
        return true;
    }

    // Normaliser avant validation
    const value = prepareForValidation(rawValue);

    if (value.length < 2) {
        setFieldState('unite', 'error', 'L\'unité doit contenir au moins 2 caractères');
        return false;
    }

    if (value.length > MAX_LENGTH.TEXT) {
        setFieldState('unite', 'error', `L\'unité ne peut pas dépasser ${MAX_LENGTH.TEXT} caractères`);
        return false;
    }

    // Accepter: lettres Unicode (\p{L}), chiffres (\p{N}), espaces, apostrophes, tirets, slashs, parenthèses, points
    const allowedCharsRegex = /^[\p{L}\p{N}\s'\-\/().]+$/u;
    if (!allowedCharsRegex.test(value)) {
        setFieldState('unite', 'error', 'L\'unité contient des caractères non autorisés');
        return false;
    }

    // Protection contre abus : 4+ caractères identiques consécutifs
    const consecutiveRegex = /(.)\1{3,}/;
    if (consecutiveRegex.test(value)) {
        setFieldState('unite', 'error', 'L\'unité ne peut pas contenir 4 caractères identiques consécutifs');
        return false;
    }

    setFieldState('unite', 'success');
    return true;
}

// Fonction générique pour valider les champs select
function validateSelect(selectId) {
    const select = document.getElementById(selectId);
    if (!select) {
        console.warn(`Select non trouvé: ${selectId}`);
        return true;
    }

    const value = select.value;

    if (!value || value === '') {
        setFieldState(selectId, 'neutral');
        return true;
    }

    setFieldState(selectId, 'success');
    return true;
}

// Validation de la date des faits (ne doit pas être dans le futur)
function validateDateFaits() {
    const dateFaits = document.getElementById('dateFaits');
    const value = dateFaits.value;

    if (!value) {
        setFieldState('dateFaits', 'neutral');
        return true;
    }

    // Obtenir la date du jour à minuit (sans heure)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Parser la date saisie
    const selectedDate = new Date(value + 'T00:00:00');

    // Vérifier si la date est dans le futur
    if (selectedDate > today) {
        setFieldState('dateFaits', 'error', 'La date des faits ne peut pas être dans le futur');
        return false;
    }

    setFieldState('dateFaits', 'success');
    return true;
}

// Validation de la commune des faits
function validateCommune() {
    const commune = document.getElementById('commune');
    const rawValue = commune.value.trim();

    if (!rawValue) {
        setFieldState('commune', 'neutral');
        return true;
    }

    // Normaliser avant validation
    const value = prepareForValidation(rawValue);

    if (value.length < 2) {
        setFieldState('commune', 'error', 'La commune doit contenir au moins 2 caractères');
        return false;
    }

    if (value.length > MAX_LENGTH.NAME) {
        setFieldState('commune', 'error', `La commune ne peut pas dépasser ${MAX_LENGTH.NAME} caractères`);
        return false;
    }

    // Accepter toutes les lettres Unicode (\p{L}), espaces, apostrophes, tirets
    const allowedCharsRegex = /^[\p{L}\s'\-]+$/u;
    if (!allowedCharsRegex.test(value)) {
        setFieldState('commune', 'error', 'La commune contient des caractères non autorisés');
        return false;
    }

    // Protection contre abus : 4+ caractères identiques consécutifs
    const consecutiveRegex = /(.)\1{3,}/;
    if (consecutiveRegex.test(value)) {
        setFieldState('commune', 'error', 'La commune ne peut pas contenir 4 caractères identiques consécutifs');
        return false;
    }

    setFieldState('commune', 'success');
    return true;
}

// Validation du montant des dommages et intérêts
function validateMontantDommages() {
    const montantDommages = document.getElementById('montantDommages');
    const value = montantDommages.value;

    if (!value || value === '') {
        setFieldState('montantDommages', 'neutral');
        return true;
    }

    const montant = parseFloat(value);

    if (isNaN(montant) || montant < 0) {
        setFieldState('montantDommages', 'error', 'Le montant doit être un nombre positif');
        return false;
    }

    if (montant > 999999999) {
        setFieldState('montantDommages', 'error', 'Le montant est trop élevé');
        return false;
    }

    setFieldState('montantDommages', 'success');
    return true;
}

// Validation de la date d'audience
function validateDateAudience() {
    const dateAudienceDate = document.getElementById('dateAudienceDate');
    const value = dateAudienceDate.value;

    if (!value) {
        setFieldState('dateAudienceDate', 'neutral');
        return true;
    }

    // Simplement valider qu'une date est sélectionnée (pas de restriction passé/futur)
    setFieldState('dateAudienceDate', 'success');
    return true;
}

// Activer/désactiver le champ montant lié à la constitution de partie civile
function togglePartieCivileFields() {
    const partieCivile = document.getElementById('partieCivile');
    const montantDommages = document.getElementById('montantDommages');

    if (!partieCivile || !montantDommages) {
        console.warn('Éléments de partie civile non trouvés');
        return;
    }

    const isChecked = partieCivile.checked;

    // Activer ou désactiver le champ montant
    montantDommages.disabled = !isChecked;

    // Si la case est décochée, effacer la valeur et réinitialiser l'état visuel
    if (!isChecked) {
        montantDommages.value = '';
        setFieldState('montantDommages', 'neutral');
    }
}

// Mise à jour automatique de la date de signature
function updateSignatureDate() {
    if (!signatureDate) return;

    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    signatureDate.value = `${day}/${month}/${year} à ${hours}:${minutes}`;
}

// ============ UTILITAIRES ============

function setupCharacterCounters() {
    const counters = [
        { fieldId: 'resume', counterId: 'resumeCounter' },
        { fieldId: 'blessures', counterId: 'blessuresCounter' },
        { fieldId: 'qualificationsPenales', counterId: 'qualificationsPenalesCounter' }
    ];

    counters.forEach(({ fieldId, counterId }) => {
        const field = document.getElementById(fieldId);
        const counter = document.getElementById(counterId);

        if (field && counter) {
            // Initialiser le compteur
            counter.textContent = field.value.length;

            // Mettre à jour le compteur à chaque saisie
            field.addEventListener('input', function() {
                counter.textContent = this.value.length;
            });
        }
    });
}

function applyTrimToAllFields() {
    const fields = document.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], textarea');

    fields.forEach(field => {
        field.addEventListener('input', function(e) {
            if (e.target.value.startsWith(' ')) {
                e.target.value = e.target.value.trimStart();
            }
        });

        field.addEventListener('blur', function(e) {
            e.target.value = e.target.value.trim();
        });
    });
}

function setupReadonlyFields() {
    // Champs avec readonly pour empêcher l'autocomplétion indésirable
    const readonlyFields = ['emailPro', 'codePostal', 'blessures', 'emailAutoriteHierarchique'];

    readonlyFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            // Retirer readonly sur plusieurs événements pour gérer Safari et l'autocomplétion
            const removeReadonly = function() {
                this.removeAttribute('readonly');
            };

            field.addEventListener('focus', removeReadonly);
            field.addEventListener('mousedown', removeReadonly);
            field.addEventListener('touchstart', removeReadonly);
        }
    });
}

function generateTimestamp() {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${day}/${month}/${year} à ${hours}:${minutes}:${seconds}`;
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

function formatDateTime(dateString, timeString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    if (timeString) return `${day}/${month}/${year} ${timeString}`;
    return `${day}/${month}/${year}`;
}

// ============ GÉNÉRATION DU MAIL ============

function generateMail(formData) {
    let mail = 'Le BRPF est destinataire d\'une nouvelle demande de protection fonctionnelle :\r\n\r\n';
    mail += `Type de demande: ${formData.type}\r\n\r\n`;

    mail += '=== INFORMATIONS SUR LE DEMANDEUR ===\r\n\r\n';
    mail += `Nom: ${formData.nom}\r\n`;
    mail += `Prénom: ${formData.prenom}\r\n`;
    mail += `Grade: ${formData.grade}\r\n`;
    mail += `NIGEND: ${formData.nigend}\r\n`;
    mail += `Statut du demandeur: ${formData.statutDemandeur}\r\n`;
    mail += `Branche: ${formData.branche}\r\n`;
    mail += `Formation administrative: ${formData.formationAdministrative}\r\n`;
    mail += `Département: ${formData.departement}\r\n`;
    mail += `Unité: ${formData.unite}\r\n`;
    mail += `Courriel professionnel: ${formData.emailPro}\r\n`;
    mail += `Courriel personnel: ${formData.emailPerso}\r\n`;
    mail += `TPH professionnel: ${formData.telPro}\r\n`;
    mail += `TPH personnel: ${formData.telPerso}\r\n\r\n`;

    mail += '=== INFORMATIONS SUR LES FAITS ===\r\n\r\n';
    mail += `Date des faits: ${formatDate(formData.dateFaits)}\r\n`;
    mail += `Commune des faits: ${formData.commune}\r\n`;
    mail += `Code postal des faits: ${formData.codePostal}\r\n`;
    mail += `Position administrative: ${formData.position}\r\n`;
    mail += `Contexte missionnel: ${formData.contexteMissionnel}\r\n`;
    mail += `Qualification de l'infraction: ${formData.qualificationInfraction}\r\n`;
    mail += `Résumé de la situation: ${formData.resume}\r\n`;
    mail += `Blessures: ${formData.blessures}\r\n\r\n`;

    mail += '=== INFORMATIONS JUDICIAIRES ===\r\n\r\n';
    mail += `Constitution de partie civile: ${formData.partieCivile ? 'OUI' : 'NON'}\r\n`;
    mail += `Montant dommages intérêts: ${formData.montantDommages}\r\n`;
    mail += `Qualification pénale susceptible d'être retenue: ${formData.qualificationsPenales}\r\n`;
    mail += `Date d'audience: ${formatDateTime(formData.dateAudienceDate, formData.dateAudienceTime)}\r\n\r\n`;

    mail += '=== SOUTIENS DEMANDÉS ===\r\n\r\n';
    mail += `Soutien médical: ${formData.soutienMedical ? 'OUI' : 'NON'}\r\n`;
    mail += `Soutien psychologique: ${formData.soutienPsychologique ? 'OUI' : 'NON'}\r\n`;
    mail += `Soutien social: ${formData.soutienSocial ? 'OUI' : 'NON'}\r\n`;

    if (formData.emailAutoriteHierarchique) {
        mail += '\r\n=== AUTORITÉ HIÉRARCHIQUE ===\r\n\r\n';
        mail += `Courriel: ${formData.emailAutoriteHierarchique}\r\n`;
    }

    mail += '\r\n=== SIGNATURE ===\r\n\r\n';
    mail += `Signé par: ${formData.signatureNomPrenom}\r\n`;
    mail += `Le: ${formData.signatureHorodatage}\r\n`;

    return mail;
}

function getFormData() {
    // Utiliser l'élément DOM directement pour la signature
    const signatureNomPrenomElement = document.getElementById('signatureNomPrenom');
    const signatureNomPrenomValue = signatureNomPrenomElement ?
        signatureNomPrenomElement.value.trim() : '';

    return {
        type: document.getElementById('type').value,
        nigend: document.getElementById('nigend').value,
        grade: document.getElementById('grade').value,
        statutDemandeur: document.getElementById('statutDemandeur').value,
        branche: document.getElementById('branche').value,
        formationAdministrative: document.getElementById('formationAdministrative').value,
        departement: document.getElementById('departement').value,
        nom: document.getElementById('nom').value,
        prenom: document.getElementById('prenom').value,
        emailPro: document.getElementById('emailPro').value,
        emailPerso: document.getElementById('emailPerso').value,
        telPro: document.getElementById('telPro').value,
        telPerso: document.getElementById('telPerso').value,
        unite: document.getElementById('unite').value,
        dateFaits: document.getElementById('dateFaits').value,
        commune: document.getElementById('commune').value,
        codePostal: document.getElementById('codePostal').value,
        position: document.getElementById('position').value,
        contexteMissionnel: document.getElementById('contexteMissionnel').value,
        qualificationInfraction: document.getElementById('qualificationInfraction').value,
        resume: document.getElementById('resume').value,
        blessures: document.getElementById('blessures').value,
        partieCivile: document.getElementById('partieCivile').checked,
        montantDommages: document.getElementById('montantDommages').value,
        qualificationsPenales: document.getElementById('qualificationsPenales').value,
        dateAudienceDate: document.getElementById('dateAudienceDate').value,
        dateAudienceTime: document.getElementById('dateAudienceTime').value,
        soutienMedical: document.getElementById('soutienMedical').checked,
        soutienPsychologique: document.getElementById('soutienPsychologique').checked,
        soutienSocial: document.getElementById('soutienSocial').checked,
        emailAutoriteHierarchique: document.getElementById('emailAutoriteHierarchique').value,
        signatureNomPrenom: signatureNomPrenomValue,
        signatureHorodatage: generateTimestamp()
    };
}

// ============ GESTION DU FORMULAIRE ============

function handleFormSubmit(e) {
    e.preventDefault();

    // Mettre à jour la date de signature au moment de la soumission
    updateSignatureDate();

    // Validation des champs personnalisés
    const phonesValid = validatePhones();
    const emailsValid = validateEmails();
    const emailAutoriteValid = validateEmailAutoriteHierarchique();
    const codePostalValid = validateCodePostal();
    const nigendValid = validateNigend();
    const nomValid = validateNom();
    const prenomValid = validatePrenom();
    const signatureNomPrenomValid = validateSignatureNomPrenom();
    const uniteValid = validateUnite();
    const dateFaitsValid = validateDateFaits();
    const communeValid = validateCommune();
    const montantDommagesValid = validateMontantDommages();
    const dateAudienceValid = validateDateAudience();

    // Vérifier la validation native HTML5
    if (!form.checkValidity()) {
        form.reportValidity();
        showErrorMessage();
        return;
    }

    // Vérifier les validations personnalisées
    if (!phonesValid || !emailsValid || !emailAutoriteValid || !codePostalValid || !nigendValid || !nomValid || !prenomValid || !signatureNomPrenomValid || !uniteValid || !dateFaitsValid || !communeValid || !montantDommagesValid || !dateAudienceValid) {
        showErrorMessage();
        scrollToFirstError(nigendValid, nomValid, prenomValid, signatureNomPrenomValid, phonesValid, emailsValid, emailAutoriteValid, codePostalValid, uniteValid, dateFaitsValid, communeValid, montantDommagesValid, dateAudienceValid);
        return;
    }

    const formData = getFormData();
    const mailText = generateMail(formData);

    // Construire le mailto
    const subject = `Demande de protection fonctionnelle - ${formData.grade} ${formData.nom} ${formData.prenom}`;
    let mailto = `mailto:protection-fonctionnelle@gendarmerie.interieur.gouv.fr?subject=${encodeURIComponent(subject)}`;

    // Construire la liste des emails en copie
    const ccEmails = [];
    if (formData.emailPro && formData.emailPro.trim() !== '') {
        ccEmails.push(formData.emailPro.trim());
    }
    if (formData.emailPerso && formData.emailPerso.trim() !== '') {
        ccEmails.push(formData.emailPerso.trim());
    }
    if (formData.emailAutoriteHierarchique && formData.emailAutoriteHierarchique.trim() !== '') {
        ccEmails.push(formData.emailAutoriteHierarchique.trim());
    }

    if (ccEmails.length > 0) {
        mailto += `&cc=${encodeURIComponent(ccEmails.join(','))}`;
    }

    mailto += `&body=${encodeURIComponent(mailText)}`;

    // Vérifier la longueur de l'URL mailto
    console.log(`Générateur PF: Longueur de l'URL mailto = ${mailto.length} caractères (limite: ${MAILTO_MAX_LENGTH})`);

    // Stocker les données pour utilisation après confirmation
    pendingMailtoData = {
        mailto: mailto,
        mailText: mailText,
        subject: subject,
        ccEmails: ccEmails,
        isOverLimit: mailto.length > MAILTO_MAX_LENGTH
    };

    console.log('Générateur PF: Validation réussie, affichage du modal d\'information');

    // Afficher le modal d'information avant envoi
    showInfoEnvoiModal();
}

function showErrorMessage() {
    errorMessage.style.display = 'block';
    setTimeout(() => {
        errorMessage.style.display = 'none';
    }, 5000);
}

function showInfoEnvoiModal() {
    console.log('Générateur PF: Ouverture du modal d\'information');

    // Stocker l'élément actuellement focusé
    lastFocusedElement = document.activeElement;

    // Utiliser le bouton invisible pour ouvrir le modal via le DSFR
    const triggerBtn = document.getElementById('hiddenInfoEnvoiModalTrigger');
    if (triggerBtn) {
        triggerBtn.click();
    } else {
        console.error('Bouton déclencheur du modal non trouvé');
        // Fallback : exécuter directement l'envoi
        proceedWithMailSending();
    }
}

function proceedWithMailSending() {
    if (!pendingMailtoData) {
        console.error('Aucune donnée mailto en attente');
        return;
    }

    const { mailto, mailText, subject, ccEmails, isOverLimit } = pendingMailtoData;

    if (isOverLimit) {
        console.log('Générateur PF: URL trop longue, affichage de la modal de limite');
        showMailtoLimitModal(mailText, subject, ccEmails);
    } else {
        console.log('Générateur PF: Ouverture du client mail');
        openMailClient(mailto);
        clearDraft();
    }

    // Réinitialiser les données en attente
    pendingMailtoData = null;
}

function scrollToFirstError(nigendValid, nomValid, prenomValid, phonesValid, emailsValid, emailAutoriteValid, codePostalValid, uniteValid, dateFaitsValid, communeValid, montantDommagesValid, dateAudienceValid) {
    if (!nigendValid) {
        nigend.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (!nomValid) {
        nom.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (!prenomValid) {
        prenom.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (!uniteValid) {
        document.getElementById('unite').scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (!phonesValid) {
        telPro.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (!emailsValid) {
        emailPro.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (!emailAutoriteValid) {
        emailAutoriteHierarchique.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (!codePostalValid) {
        codePostal.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (!dateFaitsValid) {
        document.getElementById('dateFaits').scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (!communeValid) {
        document.getElementById('commune').scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (!montantDommagesValid) {
        document.getElementById('montantDommages').scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (!dateAudienceValid) {
        document.getElementById('dateAudienceDate').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function openMailClient(mailto) {
    const link = document.createElement('a');
    link.href = mailto;
    link.target = '_top';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function showMailtoLimitModal(mailText, subject, ccEmails) {
    console.log('Générateur PF: Création de la modal de limite mailto');

    // Stocker l'élément actuellement focusé
    lastFocusedElement = document.activeElement;

    // Créer l'overlay de la modal
    const overlay = document.createElement('div');
    overlay.className = 'custom-modal-overlay';
    overlay.id = 'mailtoLimitModalOverlay';

    // Fonction pour fermer la modal et restaurer le focus
    const closeModal = () => {
        overlay.remove();
        if (lastFocusedElement) {
            lastFocusedElement.focus();
            lastFocusedElement = null;
        }
    };

    // Créer la structure du modal de manière sécurisée (sans innerHTML)
    const modalContent = document.createElement('div');
    modalContent.className = 'custom-modal-content';

    // Header
    const header = document.createElement('div');
    header.className = 'custom-modal-header';
    const h2 = document.createElement('h2');
    h2.textContent = 'Contenu trop long pour le client mail';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'custom-modal-close';
    closeBtn.setAttribute('aria-label', 'Fermer la fenêtre');
    closeBtn.innerHTML = '✕<span class="sr-only">Fermer la fenêtre</span>';
    closeBtn.addEventListener('click', closeModal);
    header.appendChild(h2);
    header.appendChild(closeBtn);

    // Body
    const body = document.createElement('div');
    body.className = 'custom-modal-body';

    // Alert
    const alert = document.createElement('div');
    alert.className = 'fr-alert fr-alert--info';
    alert.style.marginBottom = '1.5rem';
    const alertTitle = document.createElement('p');
    alertTitle.className = 'fr-alert__title';
    alertTitle.textContent = 'Contenu trop long pour envoi automatique';
    const alertDesc = document.createElement('p');
    alertDesc.className = 'fr-alert__desc';
    const strong = document.createElement('strong');
    strong.textContent = 'Procédure recommandée :';
    alertDesc.appendChild(strong);
    alertDesc.appendChild(document.createElement('br'));
    alertDesc.appendChild(document.createTextNode('1. Cliquez sur "Copier le contenu" pour copier le texte du mail'));
    alertDesc.appendChild(document.createElement('br'));
    alertDesc.appendChild(document.createTextNode('2. Cliquez sur "Ouvrir le client mail" pour ouvrir un mail pré-rempli'));
    alertDesc.appendChild(document.createElement('br'));
    alertDesc.appendChild(document.createTextNode('3. Collez le contenu copié dans le corps du mail'));
    alert.appendChild(alertTitle);
    alert.appendChild(alertDesc);

    // Footer buttons
    const footer = document.createElement('div');
    footer.className = 'custom-modal-footer';
    footer.style.marginTop = '0';
    footer.style.marginBottom = '1.5rem';
    const copyBtn = document.createElement('button');
    copyBtn.className = 'fr-btn fr-btn--primary';
    copyBtn.id = 'copyMailContent';
    copyBtn.textContent = '1. Copier le contenu';
    const openBtn = document.createElement('button');
    openBtn.className = 'fr-btn';
    openBtn.id = 'openMailClient';
    openBtn.textContent = '2. Ouvrir le client mail';
    const closeBtn2 = document.createElement('button');
    closeBtn2.className = 'fr-btn fr-btn--secondary';
    closeBtn2.textContent = 'Fermer';
    closeBtn2.addEventListener('click', closeModal);
    footer.appendChild(copyBtn);
    footer.appendChild(openBtn);
    footer.appendChild(closeBtn2);

    // Callout
    const callout = document.createElement('div');
    callout.className = 'fr-callout';
    callout.style.marginBottom = '1.5rem';
    const calloutText = document.createElement('p');
    calloutText.className = 'fr-callout__text';
    const destStrong = document.createElement('strong');
    destStrong.textContent = 'Destinataire : ';
    calloutText.appendChild(destStrong);
    calloutText.appendChild(document.createTextNode('protection-fonctionnelle@gendarmerie.interieur.gouv.fr'));
    calloutText.appendChild(document.createElement('br'));
    if (ccEmails.length > 0) {
        const ccStrong = document.createElement('strong');
        ccStrong.textContent = 'Copie (Cc) : ';
        calloutText.appendChild(ccStrong);
        calloutText.appendChild(document.createTextNode(ccEmails.join(', ')));
        calloutText.appendChild(document.createElement('br'));
    }
    const objStrong = document.createElement('strong');
    objStrong.textContent = 'Objet : ';
    calloutText.appendChild(objStrong);
    calloutText.appendChild(document.createTextNode(subject));
    callout.appendChild(calloutText);

    // Input group
    const inputGroup = document.createElement('div');
    inputGroup.className = 'fr-input-group';
    inputGroup.style.marginBottom = '1rem';
    const label = document.createElement('label');
    label.className = 'fr-label';
    label.htmlFor = 'mailContent';
    label.textContent = 'Contenu du mail :';
    const textarea = document.createElement('textarea');
    textarea.className = 'fr-input';
    textarea.id = 'mailContent';
    textarea.rows = 15;
    textarea.readOnly = true;
    textarea.style.fontFamily = 'monospace';
    textarea.style.fontSize = '0.875rem';
    textarea.value = mailText; // Utiliser .value au lieu de .textContent pour les textarea
    inputGroup.appendChild(label);
    inputGroup.appendChild(textarea);

    // Assembler
    body.appendChild(alert);
    body.appendChild(footer);
    body.appendChild(callout);
    body.appendChild(inputGroup);
    modalContent.appendChild(header);
    modalContent.appendChild(body);
    overlay.appendChild(modalContent);

    document.body.appendChild(overlay);
    console.log('Générateur PF: Modal ajoutée au DOM');

    // Afficher la modal avec une petite animation
    setTimeout(() => {
        overlay.classList.add('active');
        console.log('Générateur PF: Modal affichée');
        // Déplacer le focus sur le premier bouton d'action
        copyBtn.focus();
    }, 10);

    // Gérer le bouton de copie
    document.getElementById('copyMailContent').addEventListener('click', function() {
        const textarea = document.getElementById('mailContent');
        textarea.select();
        navigator.clipboard.writeText(mailText).then(() => {
            const originalText = this.textContent;
            this.textContent = '1. Contenu copié ✓';
            this.disabled = true;
            setTimeout(() => {
                this.textContent = originalText;
                this.disabled = false;
            }, 2000);
        }).catch(() => {
            alert('Erreur lors de la copie. Veuillez sélectionner et copier manuellement le texte.');
        });
    });

    // Gérer le bouton d'ouverture du client mail (sans le body)
    document.getElementById('openMailClient').addEventListener('click', function() {
        let mailto = `mailto:protection-fonctionnelle@gendarmerie.interieur.gouv.fr?subject=${encodeURIComponent(subject)}`;

        if (ccEmails.length > 0) {
            mailto += `&cc=${encodeURIComponent(ccEmails.join(','))}`;
        }

        console.log('Générateur PF: Ouverture du client mail (sans body)');

        // Utiliser la même méthode que openMailClient() pour compatibilité iframe
        const link = document.createElement('a');
        link.href = mailto;
        link.target = '_top';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // Fermer la modal en cliquant sur l'overlay
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            closeModal();
        }
    });
}

function handleFormReset(e) {
    if (confirm('Êtes-vous sûr de vouloir réinitialiser le formulaire ? Les données sauvegardées automatiquement seront également supprimées.')) {
        errorMessage.style.display = 'none';

        // Réinitialiser tous les états de validation DSFR
        const fieldsToReset = ['nom', 'prenom', 'nigend', 'emailPro', 'emailPerso',
                               'telPro', 'telPerso', 'codePostal', 'emailAutoriteHierarchique', 'unite',
                               'type', 'grade', 'statutDemandeur', 'branche', 'formationAdministrative',
                               'departement', 'position', 'contexteMissionnel', 'qualificationInfraction',
                               'dateFaits', 'commune', 'montantDommages', 'dateAudienceDate'];
        fieldsToReset.forEach(fieldId => {
            setFieldState(fieldId, 'neutral');
        });

        clearDraft();
        hideDraftNotification();
    } else {
        // Empêcher la réinitialisation si l'utilisateur annule
        e.preventDefault();
    }
}

// ============ LOCALSTORAGE / AUTOSAVE ============

function scheduleSaveDraft() {
    clearTimeout(autosaveTimeout);
    autosaveTimeout = setTimeout(saveDraft, AUTOSAVE_DELAY);
}

function saveDraft() {
    const formData = getFormData();
    try {
        // Chiffrer les données avant stockage
        const dataToEncrypt = JSON.stringify({
            data: formData,
            timestamp: new Date().toISOString()
        });
        const sessionKey = 'demandePF-session-key-' + (sessionStorage.getItem('sessionId') || 'default-key');
        const encrypted = CryptoJS.AES.encrypt(
            dataToEncrypt,
            sessionKey
        ).toString();
        localStorage.setItem(LOCALSTORAGE_KEY, encrypted);
    } catch (e) {
        console.error('Erreur lors de la sauvegarde du brouillon:', e);
    }
}

function loadDraft() {
    try {
        const saved = localStorage.getItem(LOCALSTORAGE_KEY);
        if (!saved) return;

        // Déchiffrer les données
        const sessionKey = 'demandePF-session-key-' + (sessionStorage.getItem('sessionId') || 'default-key');
        const decrypted = CryptoJS.AES.decrypt(
            saved,
            sessionKey
        ).toString(CryptoJS.enc.Utf8);

        if (!decrypted) {
            console.warn('Impossible de déchiffrer le brouillon');
            clearDraft();
            return;
        }

        const { data, timestamp } = JSON.parse(decrypted);

        // Ne charger que si le brouillon a moins de 3 jours
        const savedDate = new Date(timestamp);
        const now = new Date();
        const daysDiff = (now - savedDate) / (1000 * 60 * 60 * 24);

        if (daysDiff > 3) {
            clearDraft();
            return;
        }

        // Restaurer les données
        Object.keys(data).forEach(key => {
            const element = document.getElementById(key);
            if (element) {
                if (element.type === 'checkbox') {
                    element.checked = data[key];
                } else {
                    element.value = data[key];
                }
            }
        });

    } catch (e) {
        console.error('Erreur lors du chargement du brouillon:', e);
        clearDraft();
    }
}

function clearDraft() {
    try {
        localStorage.removeItem(LOCALSTORAGE_KEY);
    } catch (e) {
        console.error('Erreur lors de la suppression du brouillon:', e);
    }
}

function showDraftNotification() {
    const saved = localStorage.getItem(LOCALSTORAGE_KEY);
    if (!saved) return;

    const notification = document.createElement('div');
    notification.className = 'fr-alert fr-alert--info';
    notification.style.cssText = 'margin: 1rem auto; max-width: 1200px;';

    const p = document.createElement('p');
    p.className = 'fr-alert__desc';
    p.appendChild(document.createTextNode('Un brouillon de votre demande a été restauré. Les données sont sauvegardées automatiquement pendant votre saisie.'));

    const button = document.createElement('button');
    button.className = 'fr-btn fr-btn--sm fr-btn--secondary';
    button.id = 'clearDraftBtn';
    button.style.marginLeft = '1rem';
    button.style.marginTop = '0.75rem';
    button.textContent = 'Supprimer le brouillon';

    p.appendChild(document.createTextNode(' '));
    p.appendChild(button);
    notification.appendChild(p);

    const container = document.querySelector('.fr-container');
    container.insertBefore(notification, container.firstChild);

    document.getElementById('clearDraftBtn').addEventListener('click', function() {
        if (confirm('Êtes-vous sûr de vouloir supprimer le brouillon sauvegardé ?')) {
            clearDraft();
            location.reload();
        }
    });
}

function hideDraftNotification() {
    const notification = document.querySelector('.fr-alert.fr-alert--info');
    if (notification) {
        notification.remove();
    }
}
