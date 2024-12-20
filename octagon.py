# -*- coding: utf-8 -*-
"""
Created on Tue Oct 18 00:37:40 2022

@author: gianl
"""

from dataclasses import dataclass
import numpy as np


### define some useful 8-bit arrays
ZERO = np.zeros(8, dtype = bool)
ONE = np.ones(8, dtype = bool)

ALT = np.array([1, 0, 1, 0, 1, 0, 1, 0], dtype = bool)
NEG_ALT = ~ALT

FULL = np.array([1, 1, 0, 0, 0, 0, 0, 0], dtype = bool)
HALF = np.array([1, 0, 1, 0, 0, 0, 0, 0], dtype = bool)
QUART = np.array([1, 0, 0, 1, 0, 0, 0, 0], dtype = bool)

### define the winning 16-bit arrays
WIN_SQUARES = [np.concatenate([ALT, ZERO]),
               np.concatenate([NEG_ALT, ZERO]),
               np.concatenate([ZERO, ALT]),
               np.concatenate([ZERO, NEG_ALT])]
#np.vstack(WIN_SQUARES).astype('uint8')

WIN_ANGLES = [np.concatenate([np.roll(HALF, i), np.roll(HALF, i)]) for i in range(8)]
#np.vstack(WIN_ANGLES).astype('uint8')

WIN_CROWNS = [np.concatenate([np.roll(FULL, i), np.roll(FULL, i)]) for i in range(8)]
#np.vstack(WIN_CROWNS).astype('uint8')

WIN_LINES = [np.concatenate([np.roll(FULL, i + 1), np.roll(QUART, i)]) for i in range(8)]
#np.vstack(WIN_LINES).astype('uint8')

WINNING = np.vstack([*WIN_SQUARES, *WIN_ANGLES, *WIN_CROWNS, *WIN_LINES])
# WINNING.astype('uint8')

### define the possible moves between positions (24-bit arrays)
MOVE_START = [np.concatenate([ZERO, np.roll(FULL, i - 1), np.roll(FULL, i - 1)]) for i in range(8)]
#np.vstack(MOVE_START).astype('uint8')

MOVE_INNER = [np.concatenate([ZERO, np.roll(HALF, i - 1), np.roll(HALF, i - 1)]) for i in range(8)] 
#np.vstack(MOVE_INNER).astype('uint8')

MOVE_OUTER = [np.concatenate([ZERO, np.roll(HALF, i - 1), ZERO]) for i in range(8)] 
#np.vstack(MOVE_OUTER).astype('uint8')

MOVE = np.vstack([*MOVE_START, *MOVE_INNER, *MOVE_OUTER])

### kick out moves to the square on starts from:
np.fill_diagonal(MOVE, False) ### inplace operation!!!
# MOVE.astype('uint8')

class Board:
    ### arrays: 
    # first 8 bits: starting positions, clockwise       (starting where?)
    # next 8 bits: inner square positions, clockwise    (starting where?)
    # last 8 bits: outer square positions, clockwise    (starting where?)
    
    def __init__(self, whiteArr: np.array, blackArr: np.array, turn: str):
        self.whiteArr = whiteArr
        self.blackArr = blackArr
        self.turn = turn
        self.win = self.check_win()
    
    def __repr__(self):
        if self.win == 1:
            return f'Board(White Wins!)'
        elif self.win == -1:
            return f'Board(Black Wins!)'
        else:
            return f'Board({"White" if self.turn == "w" else "Black"} to Move)'

    @staticmethod
    def start_position():
        whiteArr = np.concatenate([np.array([1, 0, 1, 0, 1, 0, 1, 0], dtype = bool),
                                   np.zeros(8, dtype = bool),
                                   np.zeros(8, dtype = bool)])
        blackArr = np.concatenate([np.array([0, 1, 0, 1, 0, 1, 0, 1], dtype = bool),
                                   np.zeros(8, dtype = bool),
                                   np.zeros(8, dtype = bool)])
        turn = 'w'
        
        return Board(whiteArr, blackArr, turn)

    def copy(self):
        return Board(self.whiteArr, self.blackArr, self.turn)
    
    def __eq__(self, other):
        whiteSame = (self.whiteArr == other.whiteArr).all()
        blackSame = (self.blackArr == other.blackArr).all()
        turnSame = self.turn == other.turn
        
        return whiteSame and blackSame and turnSame
    
    def __ne__(self, other):
        return not self.__eq__(other)

    def check_win(self):
        
        ### for a win, compare the non-starting squares with the winning positions
        white_check = self.whiteArr[8:] & WINNING
        black_check = self.blackArr[8:] & WINNING
        
        ### if there is a win, then...
        ### ...for at least one row (which corresponds to one possible winning position),
        ### the sum of correspondences has to be four: all pieces correspond.
        white_win = (white_check.sum(axis = 1) == 4).any()
        black_win = (black_check.sum(axis = 1) == 4).any()
        
        if white_win and black_win:
            # raise Exception('Something went wrong: Both sides have winning position')
            print('Something went wrong: Both sides have winning position')
            return 999
        elif white_win:
            return 1
        elif black_win:
            return -1
        else:
            return 0
        
    def get_moves(self):
        ### Use the MOVE matrix, and thin it out where moves are illegal
        
        ### can not move where white is
        LEGAL_MOVE = np.where(self.whiteArr, False, MOVE)
        ### can not move where black is
        LEGAL_MOVE = np.where(self.blackArr, False, LEGAL_MOVE)
        
        def get_new_positions(old_position):
            
            position_indices = np.flatnonzero(old_position) ### gives indices of true
                                                        ### equivalent to np.where()[0]
            
            new_positions = []
            for old_pos in position_indices:
                away_position = old_position.copy() 
                away_position[old_pos] = False ### the piece at the old position is moving away...
                
                new_position_indices = np.flatnonzero(LEGAL_MOVE[old_pos])
                
                for new_pos in new_position_indices:
                    new_position = away_position.copy() ### ... and to a new position
                    new_position[new_pos] = True
                    new_positions.append(new_position)
            
            return np.vstack(new_positions) ### shape: Number of Moves X Positions
    
        if self.win == 0:
            if self.turn == 'w':
                return get_new_positions(self.whiteArr) 
            elif self.turn == 'b':
                return get_new_positions(self.blackArr)
        else:
            return []

    def set_move(self, move_index):
        if self.win != 0:
            print(f'Game is already won by {"White" if self.win == "w" else "Black"}!')
        else:
            new_state = self.get_moves()[move_index]
    
            if self.turn == 'w':
                self.whiteArr = new_state
                self.turn = 'b'
            elif self.turn == 'b':
                self.blackArr = new_state
                self.turn = 'w'
        
            win_con = self.check_win()
            if win_con == 1:
                self.win = 'w'
            elif win_con == -1:
                self.win = 'b'
                
    def get_successors(self):            
        new_states = self.get_moves()
    
        new_boards = []
        for state in new_states:
            if self.turn == 'w':
                new_board = Board(whiteArr = state, blackArr = self.blackArr, turn = 'b')
            elif self.turn == 'b':
                new_board = Board(whiteArr = self.whiteArr, blackArr = state, turn = 'w')
            
            new_boards.append(new_board)
            
        return new_boards
        
    
#### Build a board of positions ###

# a) do it recursively
def add_level_of_positions(positions_to_expand, positions_in_memory):
    
    print(len(positions_in_memory))
    
    if positions_to_expand == []:
        return positions_in_memory
    else:
        positions_in_memory.extend(positions_to_expand)
        
        new_positions = []
        for board in positions_to_expand:
            successors = board.get_successors()
            for succ_board in successors:
                already_seen = False
                for mem_board in positions_in_memory:
                    if succ_board == mem_board:
                        already_seen = True
                        break
                if not already_seen:
                    new_positions.append(succ_board)
        return add_level_of_positions(new_positions, positions_in_memory)

# b) do it by going through all permutations
# def find_position_permutations:
    
    
               
            
if __name__ == '__main__':
    board = Board.start_position()
     
    board.set_move(0)
    board.set_move(0)
    board.set_move(0)
    board.set_move(0)
    board.set_move(0)
    board.set_move(0)
    board.set_move(0)
    board.set_move(0)
    board.set_move(0)
    board.set_move(0)
    board.set_move(0)
    board.set_move(0)
    
    # moves = start.get_moves()  
    # moves.shape        

    
    board2 = Board.start_position()
    board3 = Board.start_position()
    board3.set_move(2)
    
    print(board2 == board3)
    
    board2.set_move(2)
    
    print(board2 == board3)

    board2.get_successors()
    board.get_successors()


    


    ### dont use this... so slow.
    # add_level_of_positions([Board.start_position()], [])







