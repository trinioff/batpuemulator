; Test d'écriture en mémoire
; Ce programme écrit des valeurs dans la RAM (adresses 0 à 5)
; pour vérifier que le container "Mémoire" se met bien à jour.

ldi r1 0xAA     ; Valeur AA
ldi r2 0xBB     ; Valeur BB
ldi r3 0xCC     ; Valeur CC
ldi r5 0        ; Adresse de départ

str r5 r1       ; Mem[0] = AA
inc r5
str r5 r2       ; Mem[1] = BB
inc r5
str r5 r3       ; Mem[2] = CC

; Lire depuis la mémoire pour vérifier (r10 devrait devenir AA)
ldi r5 0
lod r10 r5      ; r10 = Mem[0]

hlt
