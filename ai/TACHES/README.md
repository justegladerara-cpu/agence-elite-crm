# Tâches confiées à Codex par Claude

Circuit validé le 2026-10-01 (test PR #3 : Codex a répondu « OK pilotage » à une mention écrite par Claude).

1. Claude écrit la tâche dans `ai/TACHES/NNN-titre.md` sur une branche `claude/codex-NNN-titre` partie de `claude/project-thread-j6wx9s`.
2. Claude ouvre une PR brouillon vers `claude/project-thread-j6wx9s` et commente : `@codex Tâche NNN : lis ai/TACHES/NNN-titre.md et réalise-la dans cette PR.`
3. Codex travaille dans sa tâche cloud et pousse ses commits ou ouvre une PR liée.
4. Claude audite, corrige, teste (`npm run check`, Playwright) et rend compte à Juste.
5. Juste valide la fusion. Toute modification de la base de production reste soumise à son accord explicite.

## Format d'une tâche
- **Contexte** : pourquoi, pour qui.
- **À faire** : périmètre précis, fichiers concernés, patterns de `docs/DESIGN_SYSTEM.md` à suivre.
- **Interdit** : ce qu'il ne faut pas toucher (base de production, fichiers hors périmètre, nouvelles librairies).
- **Fini quand** : critères vérifiables et tests à faire passer.
- **Rendu** : mettre à jour `ai/CODEX/JOURNAL.md`, résumer dans la PR.

Codex lit `docs/PROJECT_CONTEXT.md`, `docs/DECISIONS.md`, `docs/KNOWN_ISSUES.md` et `docs/DESIGN_SYSTEM.md` avant d'agir.
