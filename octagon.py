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
QUART = np.array([1, 0, 0, 0, 1, 0, 0, 0], dtype = bool)

THRICE = np.array([1, 1, 1, 0, 0, 0, 0, 0], dtype = bool)


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

WIN_LINES = [np.concatenate([np.roll(QUART, i), np.roll(QUART, i)]) for i in range(8)]
#np.vstack(WIN_LINES).astype('uint8')

WINNING = np.vstack([*WIN_SQUARES, *WIN_ANGLES, *WIN_CROWNS, *WIN_LINES])
# WINNING.astype('uint8')

### define the possible moves between positions (24-bit arrays)
MOVE_START = [np.concatenate([ZERO, np.roll(FULL, i - 1), np.roll(FULL, i - 1)]) for i in range(8)]
#np.vstack(MOVE_START).astype('uint8')

MOVE_INNER = [np.concatenate([ZERO, ONE, np.roll(THRICE, i - 1)]) for i in range(8)]
#np.vstack(MOVE_INNER).astype('uint8')

MOVE_OUTER = [np.concatenate([ZERO, np.roll(THRICE, i - 1), ZERO]) for i in range(8)]
#np.vstack(MOVE_OUTER).astype('uint8')

MOVE = np.vstack([*MOVE_START, *MOVE_INNER, *MOVE_OUTER])

### kick out moves to the square on starts from:
np.fill_diagonal(MOVE, False) ### inplace operation!!!
# MOVE.astype('uint8')


@dataclass
class Board:
    whiteArr: np.array
    blackArr: np.array
    turn: str
    
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
            # print('Something went wrong: Both sides have winning position')
            return None
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
            
            return np.vstack(new_positions)
    
        if self.turn == 'w':
            return get_new_positions(self.whiteArr) 
        elif self.turn == 'b':
            return get_new_positions(self.blackArr)

        
        
        
        
        
        
        