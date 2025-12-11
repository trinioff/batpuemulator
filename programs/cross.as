; Dessiner une croix X sur ecran 32x32
define pixel_x 240
define pixel_y 241
define draw_pixel 242

ldi r15 pixel_x
ldi r14 pixel_y
ldi r13 draw_pixel
ldi r12 32

; Diagonale 1: (0,0) -> (31,31)
ldi r1 0
.loop1
str r15 r1
str r14 r1
str r13 r0
adi r1 1
sub r1 r12 r0
brh lt .loop1

; Diagonale 2: (31,0) -> (0,31)
ldi r1 0
ldi r3 31
.loop2
str r15 r3
str r14 r1
str r13 r0
adi r1 1
adi r3 -1
sub r1 r12 r0
brh lt .loop2

hlt
