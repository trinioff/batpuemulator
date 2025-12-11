#!/usr/bin/env python3
"""
BatPU-2 Simulator / Emulator
Simulates the execution of BatPU-2 machine code (.mc files) or assembly (.as files)
"""

import sys
from assembler import assemble
import tempfile
import os

class BatPU2:
    """BatPU-2 CPU Emulator"""
    
    def __init__(self):
        # 16 general purpose registers (r0-r15), r0 is always 0
        self.registers = [0] * 16
        
        # 256 bytes of data memory
        self.memory = [0] * 256
        
        # 1024 instructions max
        self.program = []
        
        # Program counter (10 bits, 0-1023)
        self.pc = 0
        
        # Flags
        self.zero_flag = False
        self.carry_flag = False
        
        # Call stack (16 levels max)
        self.call_stack = []
        
        # Halted state
        self.halted = False
        
        # Instruction count
        self.instruction_count = 0
        
        # Screen buffer (32x32 pixels)
        self.screen = [[0] * 32 for _ in range(32)]
        self.pixel_x = 0
        self.pixel_y = 0
        
        # Character buffer
        self.char_buffer = []
        
        # Number display
        self.number_display = None
        self.signed_mode = False
        
        # Opcodes
        self.opcodes = ['nop', 'hlt', 'add', 'sub', 'nor', 'and', 'xor', 'rsh', 
                        'ldi', 'adi', 'jmp', 'brh', 'cal', 'ret', 'lod', 'str']
    
    def reset(self):
        """Reset the CPU to initial state"""
        self.registers = [0] * 16
        self.memory = [0] * 256
        self.pc = 0
        self.zero_flag = False
        self.carry_flag = False
        self.call_stack = []
        self.halted = False
        self.instruction_count = 0
        self.screen = [[0] * 32 for _ in range(32)]
        self.pixel_x = 0
        self.pixel_y = 0
        self.char_buffer = []
        self.number_display = None
        self.signed_mode = False
    
    def load_mc(self, filename):
        """Load machine code from .mc file"""
        self.program = []
        with open(filename, 'r') as f:
            for line in f:
                line = line.strip()
                if line and len(line) == 16:
                    self.program.append(int(line, 2))
        print(f"✓ Loaded {len(self.program)} instructions from {filename}")
    
    def load_as(self, filename):
        """Load and assemble .as file"""
        # Create temp file for machine code
        with tempfile.NamedTemporaryFile(mode='w', suffix='.mc', delete=False) as tmp:
            tmp_name = tmp.name
        
        try:
            assemble(filename, tmp_name)
            self.load_mc(tmp_name)
        finally:
            os.unlink(tmp_name)
    
    def decode(self, instruction):
        """Decode a 16-bit instruction"""
        opcode = (instruction >> 12) & 0xF
        reg_a = (instruction >> 8) & 0xF
        reg_b = (instruction >> 4) & 0xF
        reg_c = instruction & 0xF
        imm8 = instruction & 0xFF
        imm10 = instruction & 0x3FF
        condition = (instruction >> 10) & 0x3
        offset = instruction & 0xF
        
        # Sign extend offset (4-bit signed)
        if offset >= 8:
            offset -= 16
        
        # Sign extend imm8 for adi
        imm8_signed = imm8 if imm8 < 128 else imm8 - 256
        
        return {
            'opcode': opcode,
            'opname': self.opcodes[opcode],
            'reg_a': reg_a,
            'reg_b': reg_b,
            'reg_c': reg_c,
            'imm8': imm8,
            'imm8_signed': imm8_signed,
            'imm10': imm10,
            'condition': condition,
            'offset': offset
        }
    
    def execute_one(self):
        """Execute one instruction, return False if halted"""
        if self.halted or self.pc >= len(self.program):
            self.halted = True
            return False
        
        instruction = self.program[self.pc]
        d = self.decode(instruction)
        opcode = d['opcode']
        
        # r0 is always 0
        self.registers[0] = 0
        
        next_pc = self.pc + 1
        
        if opcode == 0:  # NOP
            pass
        
        elif opcode == 1:  # HLT
            self.halted = True
            return False
        
        elif opcode == 2:  # ADD
            result = self.registers[d['reg_a']] + self.registers[d['reg_b']]
            self.carry_flag = result > 255
            result &= 0xFF
            self.zero_flag = result == 0
            if d['reg_c'] != 0:
                self.registers[d['reg_c']] = result
        
        elif opcode == 3:  # SUB
            result = self.registers[d['reg_a']] - self.registers[d['reg_b']]
            self.carry_flag = result >= 0  # No borrow = carry
            result &= 0xFF
            self.zero_flag = result == 0
            if d['reg_c'] != 0:
                self.registers[d['reg_c']] = result
        
        elif opcode == 4:  # NOR
            result = ~(self.registers[d['reg_a']] | self.registers[d['reg_b']]) & 0xFF
            self.zero_flag = result == 0
            if d['reg_c'] != 0:
                self.registers[d['reg_c']] = result
        
        elif opcode == 5:  # AND
            result = self.registers[d['reg_a']] & self.registers[d['reg_b']]
            self.zero_flag = result == 0
            if d['reg_c'] != 0:
                self.registers[d['reg_c']] = result
        
        elif opcode == 6:  # XOR
            result = self.registers[d['reg_a']] ^ self.registers[d['reg_b']]
            self.zero_flag = result == 0
            if d['reg_c'] != 0:
                self.registers[d['reg_c']] = result
        
        elif opcode == 7:  # RSH
            result = self.registers[d['reg_a']] >> 1
            self.carry_flag = self.registers[d['reg_a']] & 1
            self.zero_flag = result == 0
            if d['reg_c'] != 0:
                self.registers[d['reg_c']] = result
        
        elif opcode == 8:  # LDI
            if d['reg_a'] != 0:
                self.registers[d['reg_a']] = d['imm8']
        
        elif opcode == 9:  # ADI
            result = self.registers[d['reg_a']] + d['imm8_signed']
            self.carry_flag = result > 255 or result < 0
            result &= 0xFF
            self.zero_flag = result == 0
            if d['reg_a'] != 0:
                self.registers[d['reg_a']] = result
        
        elif opcode == 10:  # JMP
            next_pc = d['imm10']
        
        elif opcode == 11:  # BRH
            condition = d['condition']
            should_branch = False
            if condition == 0:  # EQ/Z
                should_branch = self.zero_flag
            elif condition == 1:  # NE/NZ
                should_branch = not self.zero_flag
            elif condition == 2:  # GE/C
                should_branch = self.carry_flag
            elif condition == 3:  # LT/NC
                should_branch = not self.carry_flag
            
            if should_branch:
                next_pc = d['imm10']
        
        elif opcode == 12:  # CAL
            if len(self.call_stack) < 16:
                self.call_stack.append(self.pc + 1)
                next_pc = d['imm10']
            else:
                print("⚠ Call stack overflow!")
        
        elif opcode == 13:  # RET
            if self.call_stack:
                next_pc = self.call_stack.pop()
            else:
                print("⚠ Call stack underflow!")
        
        elif opcode == 14:  # LOD regA regB offset → regA = memory[regB + offset]
            addr = (self.registers[d['reg_b']] + d['offset']) & 0xFF
            # Handle ports (240-255)
            if addr >= 240:
                value = self._read_port(addr)
            else:
                value = self.memory[addr]
            if d['reg_a'] != 0:
                self.registers[d['reg_a']] = value
        
        elif opcode == 15:  # STR regA regB offset → memory[regA + offset] = regB
            addr = (self.registers[d['reg_a']] + d['offset']) & 0xFF
            value = self.registers[d['reg_b']]
            # Handle ports (240-255)
            if addr >= 240:
                self._write_port(addr, value)
            else:
                self.memory[addr] = value
        
        self.pc = next_pc
        self.instruction_count += 1
        self.registers[0] = 0  # Ensure r0 stays 0
        
        return True
    
    def _read_port(self, port):
        """Read from I/O port"""
        port_name = port - 240
        if port_name == 4:  # load_pixel
            x = self.pixel_x % 32
            y = self.pixel_y % 32
            return self.screen[y][x]
        elif port_name == 14:  # rng
            import random
            return random.randint(0, 255)
        elif port_name == 15:  # controller_input
            return 0  # No input
        return 0
    
    def _write_port(self, port, value):
        """Write to I/O port"""
        port_name = port - 240
        if port_name == 0:  # pixel_x
            self.pixel_x = value
        elif port_name == 1:  # pixel_y
            self.pixel_y = value
        elif port_name == 2:  # draw_pixel
            x = self.pixel_x % 32
            y = self.pixel_y % 32
            self.screen[y][x] = 1
        elif port_name == 3:  # clear_pixel
            x = self.pixel_x % 32
            y = self.pixel_y % 32
            self.screen[y][x] = 0
        elif port_name == 7:  # write_char
            chars = [' ', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '.', '!', '?']
            if 0 <= value < len(chars):
                self.char_buffer.append(chars[value])
            elif 32 <= value <= 126: # ASCII text fallback
                self.char_buffer.append(chr(value))
            else:
                self.char_buffer.append('?')
        elif port_name == 10:  # show_number
            if self.signed_mode and value >= 128:
                self.number_display = value - 256
            else:
                self.number_display = value
        elif port_name == 11:  # clear_number
            self.number_display = None
        elif port_name == 12:  # signed_mode
            self.signed_mode = True
        elif port_name == 13:  # unsigned_mode
            self.signed_mode = False
    
    def run(self, max_instructions=10000):
        """Run until halted or max instructions reached"""
        while self.instruction_count < max_instructions:
            if not self.execute_one():
                break
        
        if self.instruction_count >= max_instructions:
            print(f"⚠ Stopped after {max_instructions} instructions (possible infinite loop)")
    
    def disassemble(self, instruction):
        """Disassemble an instruction to readable format"""
        d = self.decode(instruction)
        op = d['opname'].upper()
        
        if d['opcode'] == 0:
            return "NOP"
        elif d['opcode'] == 1:
            return "HLT"
        elif d['opcode'] in [2, 3, 4, 5, 6]:  # ADD, SUB, NOR, AND, XOR
            return f"{op} r{d['reg_a']}, r{d['reg_b']}, r{d['reg_c']}"
        elif d['opcode'] == 7:  # RSH
            return f"RSH r{d['reg_a']}, r{d['reg_c']}"
        elif d['opcode'] == 8:  # LDI
            return f"LDI r{d['reg_a']}, {d['imm8']}"
        elif d['opcode'] == 9:  # ADI
            return f"ADI r{d['reg_a']}, {d['imm8_signed']}"
        elif d['opcode'] == 10:  # JMP
            return f"JMP {d['imm10']}"
        elif d['opcode'] == 11:  # BRH
            cond = ['EQ', 'NE', 'GE', 'LT'][d['condition']]
            return f"BRH {cond}, {d['imm10']}"
        elif d['opcode'] == 12:  # CAL
            return f"CAL {d['imm10']}"
        elif d['opcode'] == 13:  # RET
            return "RET"
        elif d['opcode'] == 14:  # LOD
            return f"LOD r{d['reg_a']}, r{d['reg_b']}, {d['offset']}"
        elif d['opcode'] == 15:  # STR
            return f"STR r{d['reg_a']}, r{d['reg_b']}, {d['offset']}"
        return f"??? ({instruction:016b})"
    
    def print_state(self):
        """Print current CPU state"""
        print("\n" + "="*60)
        print(f"  PC: {self.pc:4d}  |  Instructions: {self.instruction_count}  |  {'HALTED' if self.halted else 'RUNNING'}")
        print(f"  Flags: Z={int(self.zero_flag)} C={int(self.carry_flag)}")
        print("-"*60)
        print("  Registers:")
        for i in range(0, 16, 4):
            regs = [f"r{j:2d}={self.registers[j]:3d} (0x{self.registers[j]:02X})" for j in range(i, i+4)]
            print("    " + "  ".join(regs))
        
        if self.number_display is not None:
            print(f"\n  Number Display: {self.number_display}")
        
        if self.char_buffer:
            print(f"  Char Buffer: {''.join(self.char_buffer)}")
        
        # Show next instruction
        if self.pc < len(self.program) and not self.halted:
            instr = self.program[self.pc]
            print(f"\n  Next: [{self.pc:4d}] {self.disassemble(instr)}")
        print("="*60)
    
    def print_screen(self):
        """Print the screen buffer"""
        print("\n  Screen (32x32):")
        print("  +" + "-"*32 + "+")
        for row in self.screen:
            line = "".join("█" if p else " " for p in row)
            print(f"  |{line}|")
        print("  +" + "-"*32 + "+")
    
    def print_memory(self, start=0, count=64):
        """Print memory contents"""
        print(f"\n  Memory [{start}-{start+count-1}]:")
        for i in range(start, min(start+count, 256), 16):
            values = [f"{self.memory[j]:02X}" for j in range(i, min(i+16, 256))]
            print(f"  {i:3d}: " + " ".join(values))


def interactive_mode(cpu):
    """Interactive debugger mode"""
    print("\n" + "="*60)
    print("  BatPU-2 Interactive Simulator")
    print("="*60)
    print("  Commands:")
    print("    s, step     - Execute one instruction")
    print("    r, run      - Run until halt")
    print("    n, run N    - Run N instructions")
    print("    p, print    - Print CPU state")
    print("    m, mem      - Print memory")
    print("    scr, screen - Print screen buffer")
    print("    d, disasm   - Disassemble program")
    print("    reset       - Reset CPU")
    print("    q, quit     - Quit")
    print("="*60)
    
    cpu.print_state()
    
    while True:
        try:
            cmd = input("\n> ").strip().lower().split()
            if not cmd:
                continue
            
            if cmd[0] in ['q', 'quit', 'exit']:
                break
            
            elif cmd[0] in ['s', 'step']:
                if cpu.execute_one():
                    cpu.print_state()
                else:
                    print("  Program halted.")
                    cpu.print_state()
            
            elif cmd[0] in ['r', 'run']:
                if len(cmd) > 1:
                    try:
                        n = int(cmd[1])
                        for _ in range(n):
                            if not cpu.execute_one():
                                break
                    except ValueError:
                        cpu.run()
                else:
                    cpu.run()
                cpu.print_state()
            
            elif cmd[0] in ['p', 'print', 'state']:
                cpu.print_state()
            
            elif cmd[0] in ['m', 'mem', 'memory']:
                start = int(cmd[1]) if len(cmd) > 1 else 0
                count = int(cmd[2]) if len(cmd) > 2 else 64
                cpu.print_memory(start, count)
            
            elif cmd[0] in ['scr', 'screen']:
                cpu.print_screen()
            
            elif cmd[0] in ['d', 'disasm', 'disassemble']:
                start = int(cmd[1]) if len(cmd) > 1 else 0
                count = int(cmd[2]) if len(cmd) > 2 else min(20, len(cpu.program))
                print(f"\n  Disassembly [{start}-{start+count-1}]:")
                for i in range(start, min(start+count, len(cpu.program))):
                    marker = ">>>" if i == cpu.pc else "   "
                    print(f"  {marker} [{i:4d}] {cpu.disassemble(cpu.program[i])}")
            
            elif cmd[0] == 'reset':
                cpu.reset()
                print("  CPU reset.")
                cpu.print_state()
            
            else:
                print(f"  Unknown command: {cmd[0]}")
        
        except KeyboardInterrupt:
            print("\n  Interrupted.")
        except Exception as e:
            print(f"  Error: {e}")


def main():
    if len(sys.argv) < 2:
        print("Usage: python simulator.py <program.as|program.mc> [--run]")
        print("")
        print("Options:")
        print("  --run    Run program directly instead of interactive mode")
        print("")
        print("Examples:")
        print("  python simulator.py programs/helloworld.as")
        print("  python simulator.py programs/helloworld.mc --run")
        sys.exit(1)
    
    filename = sys.argv[1]
    run_mode = '--run' in sys.argv
    
    cpu = BatPU2()
    
    if filename.endswith('.as'):
        cpu.load_as(filename)
    elif filename.endswith('.mc'):
        cpu.load_mc(filename)
    else:
        print(f"Unknown file type: {filename}")
        print("Supported: .as (assembly) or .mc (machine code)")
        sys.exit(1)
    
    if run_mode:
        cpu.run()
        cpu.print_state()
        if any(any(row) for row in cpu.screen):
            cpu.print_screen()
    else:
        interactive_mode(cpu)


if __name__ == '__main__':
    main()
