/* Chargement « barre de musculation » : seulement au premier lancement du site dans la session.
   Script minuscule et bloquant pour décider avant l'affichage (aucun flash du chargement ensuite). */
try {
  if (sessionStorage.getItem('nc-loader') === '1') document.documentElement.classList.add('no-loader');
} catch (e) { /* navigation privée : on affiche le chargement */ }
