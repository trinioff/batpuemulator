# ⚡ Documentation du Simulateur BatPU-2

Emulateur batpu avec flask

## 🚀 Installation

### Prérequis

- **Python 3.8+**

### Configuration
1. Clonez le repo :
   ```bash
   git clone https://github.com/trinioff/batpuemulator
   cd BatPU-2-main
   ```

## 🎮 Utilisation

### Lancer le Simulateur
Exécutez la commande suivante dans votre terminal :
```bash
python3 simulator_gui.py
```
Cela ouvrira automatiquement votre navigateur web à l'adresse `http://localhost:8080`.

### Aperçu de l'Interface

1. **Éditeur de Code (Panneau de Gauche)**
   - Tapez votre code assembleur directement.
   - Coloration syntaxique pour les opcodes, registres, nombres et labels.
   - Ou **Glissez & Déposez** un fichier `.as` dans la zone dédiée.

2. **Contrôles**
   - **⚙️ Assembler** : Charge le code dans la mémoire du CPU.
   - **⏭️ Step** : Exécute une instruction à la fois.
   - **▶️ Run** : Exécute le programme jusqu'à `HLT` ou limite atteinte.
   - **🔄 Reset** : Réinitialise l'état du CPU (Registres, RAM, Flags).

3. **État du CPU (Panneau de Droite)**
   - **PC** : Compteur de Programme (adresse instruction actuelle).
   - **Flags** : Zéro (Z) et Retenue (C).
   - **Registres** : Valeurs de r0 à r15 (surbrillance si non nul).
   - **Sortie** : Affiche la sortie standard (Afficheur Numérique, Buffer de Caractères).

4. **Mémoire & Désassemblage**
   - **Désassemblage** : Affiche le code machine retraduit en assembleur.
   - **Mémoire** : Visualise les 128 premiers octets de la RAM.

## 🛠 Dépannage

- **Erreur "Module not found"** : lancer depuis le folder
- **Port 8080 déjà utilisé** : check le port dans le shell
