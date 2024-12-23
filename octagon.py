# -*- coding: utf-8 -*-
"""
Created on Tue Oct 18 00:37:40 2022

@author: gianl
"""

import numpy as np
from shapes import BGRFrame, Point2D, Line
     
RGB = {'ball_yellow': (223, 255, 79),
	'soft_yellow': (254, 232, 81),
	'fair_yellow': (249, 223, 48),
	'taxi_yellow': (240, 233, 149),
	
	'minty_green': (53, 185, 151),
	'grass_green': (145, 193, 62),
	'leafy_green': (34, 175, 75),
	'bluey_green': (8, 185, 165),
	
	'strong_blue': (15, 137, 202),
	'bright_blue': (29, 162, 220),
	'marine_blue': (26, 87, 143),
	
	'salmon_pink': (240, 85, 97),
	'strong_pink': (238, 34, 74),
	
	'rose_orange': (238, 87, 61),
	'sign_orange': (143, 87, 26),

	'light_brown': (203, 119, 35),

	'intense_red': (238, 37, 36),

	'bright_grey': (238, 238, 238),
	'smokey_grey': (150, 150, 150)
	}

BGR = {name: (val[2], val[1], val[0]) for name, val in RGB.items()}


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
    
    def __init__(self, whiteArr: np.array, blackArr: np.array, turn: str, white_name = 'Matteo', black_name = 'Federico'):
        self.whiteArr = whiteArr
        self.blackArr = blackArr
        self.turn = turn
        self.white_name = white_name
        self.black_name = black_name
        self.win = self.check_win()
    
    def __repr__(self):
        if self.win == 1:
            return f'Board({self.white_name} Wins!)'
        elif self.win == -1:
            return f'Board({self.black_name} Wins!)'
        else:
            return f'Board({self.white_name if self.turn == "w" else self.black_name} to Move.)'

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
    

class BoardViz:
	def __init__(	self, myBoard: Board, dim: int = 600, offset: float = 0.1, 
					line_color = BGR['minty_green'], 
					point_color = BGR['smokey_grey'],
					player_one_color = BGR['intense_red'],
					player_two_color = BGR['strong_blue'],
					point_thickness = 10,
					piece_thickness = 20,
					text_size = 1,
					text_where = (20, 20),
					dim_factor = 2):
		self.myBoard = myBoard
		self.dim = dim
		self.offset = offset
		self.line_color = line_color
		self.point_color = point_color
		self.player_one_color = player_one_color
		self.player_two_color = player_two_color
		self.point_thickness = point_thickness
		self.piece_thickness = piece_thickness
		self.text_size = text_size
		self.text_where = text_where
		self.dim_factor = dim_factor

		self.player_one_color_dim = tuple([min(int(val / self.dim_factor), 255) for val in player_one_color])
		self.player_two_color_dim = tuple([min(int(val / self.dim_factor), 255) for val in player_one_color])

		self.player_one_color_bright = tuple([min(int(val * self.dim_factor), 255) for val in player_one_color])
		self.player_two_color_bright = tuple([min(int(val * self.dim_factor), 255) for val in player_two_color])

		### correcting for the offset at the sides of the frame
		self.corr_dim = (1 - offset) * dim
		self.corr_off = offset / 2 * dim
		self.corr_off_comp = dim - self.corr_off

		self.center_width = 0.4
		self.outside_width = (1 - self.center_width) / 2

		self.a = self.outside_width * self.corr_dim + self.corr_off
		self.b = (self.outside_width + self.center_width) * self.corr_dim + self.corr_off

	def get_outer_points(self):
		p1, p2 = Point2D((self.a, self.corr_off)), Point2D((self.b, self.corr_off))
		p3, p4 = Point2D((self.corr_off_comp, self.a)), Point2D((self.corr_off_comp, self.b))
		p5, p6 = Point2D((self.b, self.corr_off_comp)), Point2D((self.a, self.corr_off_comp))
		p7, p8 = Point2D((self.corr_off, self.b)), Point2D((self.corr_off, self.a))
		return [p1, p2, p3, p4, p5, p6, p7, p8]

	def get_starting_points(self):
		l14, l16, l25, l27, l36, l38, l47, l58 = self.get_lines()
		s1 = l16.weak_intersect(l38)
		s2 = l14.weak_intersect(l27)
		s3 = l25.weak_intersect(l38)
		s4 = l36.weak_intersect(l14)
		s5 = l47.weak_intersect(l25)
		s6 = l58.weak_intersect(l36)
		s7 = l47.weak_intersect(l16)
		s8 = l58.weak_intersect(l27)
		return [s1, s2, s3, s4, s5, s6, s7, s8]
	
	def get_inner_points(self):
		l14, l16, l25, l27, l36, l38, l47, l58 = self.get_lines()
		i1 = l27.weak_intersect(l38)
		i2 = l14.weak_intersect(l38)
		i3 = l14.weak_intersect(l25)
		i4 = l36.weak_intersect(l25)
		i5 = l36.weak_intersect(l47)
		i6 = l58.weak_intersect(l47)
		i7 = l58.weak_intersect(l16)
		i8 = l27.weak_intersect(l16)
		return [i1, i2, i3, i4, i5, i6, i7, i8]

	def get_all_points(self):
		return [*self.get_starting_points(), *self.get_inner_points(), *self.get_outer_points()]

	def get_lines(self):
		p1, p2, p3, p4, p5, p6, p7, p8 = self.get_outer_points()
		l14 = Line(p1, p4)
		l16 = Line(p1, p6)
		l25 = Line(p2, p5)
		l27 = Line(p2, p7)
		l36 = Line(p3, p6)
		l38 = Line(p3, p8)
		l47 = Line(p4, p7)
		l58 = Line(p5, p8)
		return [l14, l16, l25, l27, l36, l38, l47, l58]

	def get_piece_points(self):
		start_points = self.get_starting_points()
		inner_points = self.get_inner_points()
		outer_points = self.get_outer_points()

		p1Idxs, p2Idxs = board_to_indices(self.myBoard)
		s, i, o = p1Idxs
		p1_start, p1_inner, p1_outer = [start_points[idx] for idx in s], [inner_points[idx] for idx in i], [outer_points[idx] for idx in o]
		
		s, i, o = p2Idxs
		p2_start, p2_inner, p2_outer = [start_points[idx] for idx in s], [inner_points[idx] for idx in i], [outer_points[idx] for idx in o]

		return [*p1_start, *p1_inner, *p1_outer], [*p2_start, *p2_inner, *p2_outer]

	def get_frame(self, selected_point = None):
		myArr = np.zeros((self.dim, self.dim, 3), dtype = np.uint8)
		myFrm = BGRFrame(myArr)

		lines = self.get_lines()
		start_points = self.get_starting_points()
		inner_points = self.get_inner_points()
		outer_points = self.get_outer_points()

		### make empty board
		emFrm = myFrm.put(lines, color = self.line_color)
		emFrm = emFrm.put(inner_points, color = self.point_color, thickness = self.point_thickness)
		emFrm = emFrm.put(outer_points, color = self.point_color, thickness = self.point_thickness)

		### make board with pieces.
		plFrm = emFrm

		p1Pts, p2Pts = self.get_piece_points()

		p1Pts_selected, p1Pts_rest = [pt for pt in p1Pts if pt == selected_point], [pt for pt in p1Pts if pt != selected_point]
		p2Pts_selected, p2Pts_rest = [pt for pt in p2Pts if pt == selected_point], [pt for pt in p2Pts if pt != selected_point] 
		
		if len(p1Pts_selected) == 0:
			plFrm = plFrm.put(p1Pts, color = self.player_one_color, thickness = self.piece_thickness)
		else:
			plFrm = plFrm.put(p1Pts_selected, color = self.player_one_color_bright, thickness = self.piece_thickness)
			plFrm = plFrm.put(p1Pts_rest, color = self.player_one_color_dim, thickness = self.piece_thickness)
		
		if len(p2Pts_selected) == 0:
			plFrm = plFrm.put(p2Pts, color = self.player_two_color, thickness = self.piece_thickness)
		else:
			plFrm = plFrm.put(p2Pts_selected, color = self.player_two_color_bright, thickness = self.piece_thickness)
			plFrm = plFrm.put(p2Pts_rest, color = self.player_two_color, thickness = self.piece_thickness)
		
		### make turn text and/or win text!
		reprStr = self.myBoard.__repr__()
		showStr = reprStr[6:-1] ### exlude 'Board()' from the repr
		plFrm = plFrm.put(showStr, where = self.text_where, size = self.text_size)

		return plFrm
	
	def show(self):
		self.get_frame().show()
			
	def select_piece(myViz, clickPt, dist_threshold = 20):
		turn = myViz.myBoard.turn
		p1Pts, p2Pts = myViz.get_piece_points()
		if turn == 'w':
			relPts = p1Pts
		else:
			relPts = p2Pts
		
		dists = [plPt.distance_to(clickPt) for plPt in relPts]
		min_idx = np.argmin(dists)
		min_dist = dists[min_idx]

		if min_dist < dist_threshold:
			return min_idx, relPts[min_idx]
		else:
			return None, None
		
	def select_target(myViz, pt_idx, clickPt, dist_threshold = 20):
		pl1Idxs, pl2Idxs = board_to_indices(myViz.myBoard)
		
		if myViz.myBoard.turn == 'w':
			s, i, o = pl1Idxs
			boardArr = myViz.myBoard.whiteArr
			nextArrs = [(idx, nextBoard.whiteArr) for idx, nextBoard in enumerate(myViz.myBoard.get_successors())]
		else:
			s, i, o = pl2Idxs
			boardArr = myViz.myBoard.blackArr
			nextArrs = [(idx, nextBoard.blackArr) for idx, nextBoard in enumerate(myViz.myBoard.get_successors())]

		idxs_rect = [pos for pos in s] + [pos + 8 for pos in i] + [pos + 16 for pos in o]

		bit_idx = idxs_rect[pt_idx]

		selArrs = [(idx, arr) for idx, arr in nextArrs if not arr[bit_idx]] ### keep boards in which we have moved away from our selected piece
		
		moveIdxs = []
		boardIdxs = []
		for board_idx, selArr in selArrs:
			difArr = selArr != boardArr
			difArr[bit_idx] = False
			assert difArr.sum() == 1
			move_to_idx = np.argmax(difArr)
			moveIdxs.append(move_to_idx)
			boardIdxs.append(board_idx)

		allPnts = myViz.get_all_points()
		valPnts = [allPnts[idx] for idx in moveIdxs]

		dists = [plPt.distance_to(clickPt) for plPt in valPnts]
		min_idx = np.argmin(dists)
		min_dist = dists[min_idx]

		board_idx = boardIdxs[min_idx]

		nextBoard = myViz.myBoard.get_successors()[board_idx]

		if min_dist < dist_threshold:
			return nextBoard
		else:
			return None
 
       
def arr_to_indices(myArr):
	sArr, iArr, oArr = myArr[:8], myArr[8:16], myArr[16:]   
	sIdxs, iIdxs, oIdxs = np.argwhere(sArr).flatten(), np.argwhere(iArr).flatten(), np.argwhere(oArr).flatten()
	return sIdxs, iIdxs, oIdxs

def board_to_indices(myBoard):
	p1Arr, p2Arr = myBoard.whiteArr, myBoard.blackArr
	return arr_to_indices(p1Arr), arr_to_indices(p2Arr)

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







