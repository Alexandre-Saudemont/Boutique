/* Remplaçant de `server-only` pendant les tests.

   Le vrai paquet lève dès qu'il est chargé hors d'un contexte serveur Next —
   c'est tout son intérêt : un composant client qui importerait un service fait
   échouer le build au lieu de laisser fuiter du code serveur.

   Les tests, eux, appellent ces services directement en Node. Le module vide
   les laisse passer. La frontière reste vérifiée là où elle compte : au build. */
export {};
