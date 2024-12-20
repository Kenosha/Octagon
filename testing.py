from octagon import Board
from shapes import BGRFrame, Point2D, Line
import numpy as np

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

def arr_to_indices(myArr):
	sArr, iArr, oArr = myArr[:8], myArr[8:16], myArr[16:]   
	sIdxs, iIdxs, oIdxs = np.argwhere(sArr).flatten(), np.argwhere(iArr).flatten(), np.argwhere(oArr).flatten()
	return sIdxs, iIdxs, oIdxs

def board_to_indices(myBoard):
	p1Arr, p2Arr = myBoard.whiteArr, myBoard.blackArr
	return arr_to_indices(p1Arr), arr_to_indices(p2Arr)

def show_board(myBoard: Board, dim: int = 600, offset: float = 0.1, 
               line_color = BGR['minty_green'], 
               point_color = BGR['smokey_grey'],
               player_one_color = BGR['intense_red'],
               player_two_color = BGR['strong_blue']):

	dim = 600
	offset = 0.1
	line_color = BGR['minty_green']
	point_color = BGR['smokey_grey']
	player_one_color = BGR['intense_red']
	player_two_color = BGR['strong_blue']
	point_thickness = 10

	myArr = np.zeros((dim, dim, 3), dtype = np.uint8)
	myFrm = BGRFrame(myArr)

	corr_dim = (1 - offset) * dim

	corr_off = offset / 2 * dim
	corr_off_comp = dim - corr_off

	center_width = 0.4
	outside_width = (1 - center_width) / 2

	a, b = outside_width * corr_dim + corr_off, (outside_width + center_width) * corr_dim + corr_off

	p1, p2 = Point2D((a, corr_off)), Point2D((b, corr_off))
	p3, p4 = Point2D((corr_off_comp, a)), Point2D((corr_off_comp, b))
	p5, p6 = Point2D((b, corr_off_comp)), Point2D((a, corr_off_comp))
	p7, p8 = Point2D((corr_off, b)), Point2D((corr_off, a))

	### lines
	l14 = Line(p1, p4)
	l16 = Line(p1, p6)
	l25 = Line(p2, p5)
	l27 = Line(p2, p7)
	l36 = Line(p3, p6)
	l38 = Line(p3, p8)
	l47 = Line(p4, p7)
	l58 = Line(p5, p8)
	lines = [l14, l16, l25, l27, l36, l38, l47, l58]

	### starting positions
	s1 = l16.weak_intersect(l38)
	s2 = l14.weak_intersect(l27)
	s3 = l25.weak_intersect(l38)
	s4 = l36.weak_intersect(l14)
	s5 = l47.weak_intersect(l25)
	s6 = l58.weak_intersect(l36)
	s7 = l47.weak_intersect(l16)
	s8 = l58.weak_intersect(l27)
	starting_points = [s1, s2, s3, s4, s5, s6, s7, s8]

	### inner circle
	i1 = l27.weak_intersect(l38)
	i2 = l14.weak_intersect(l38)
	i3 = l14.weak_intersect(l25)
	i4 = l36.weak_intersect(l25)
	i5 = l36.weak_intersect(l47)
	i6 = l58.weak_intersect(l47)
	i7 = l58.weak_intersect(l16)
	i8 = l27.weak_intersect(l16)
	inner_points = [i1, i2, i3, i4, i5, i6, i7, i8]

	### outer circle
	outer_points = [p1, p2, p3, p4, p5, p6, p7, p8]

	### make empty board
	emFrm = myFrm.put(lines, color = line_color)
	emFrm = emFrm.put(inner_points, color = point_color, thickness = point_thickness)
	emFrm = emFrm.put(outer_points, color = point_color, thickness = point_thickness)

	### make board with pieces.
	plFrm = emFrm
	p1Idxs, p2Idxs = board_to_indices(myBoard)

	s, i, o = p1Idxs
	p1_start, p1_inner, p1_outer = [starting_points[idx] for idx in s], [inner_points[idx] for idx in i], [outer_points[idx] for idx in o]
	plFrm = plFrm.put(p1_start, color = player_one_color, thickness = point_thickness)
	plFrm = plFrm.put(p1_inner, color = player_one_color, thickness = point_thickness)
	plFrm = plFrm.put(p1_outer, color = player_one_color, thickness = point_thickness)
	
	s, i, o = p2Idxs
	p2_start, p2_inner, p2_outer = [starting_points[idx] for idx in s], [inner_points[idx] for idx in i], [outer_points[idx] for idx in o]
	plFrm = plFrm.put(p2_start, color = player_two_color, thickness = point_thickness)
	plFrm = plFrm.put(p2_inner, color = player_two_color, thickness = point_thickness)
	plFrm = plFrm.put(p2_outer, color = player_two_color, thickness = point_thickness)
	
	plFrm.show()


# myBoard = Board.start_position()
# show_board(myBoard)

# for idx, _ in enumerate(myBoard.get_moves()):
# 	myBoard = Board.start_position()
# 	myBoard.set_move(idx)
# 	show_board(myBoard)

# myBoard = Board.start_position()
# myBoard.set_move(0)

# for idx, _ in enumerate(myBoard.get_moves()):
# 	nextBoard = myBoard.copy()
# 	nextBoard.set_move(idx)
# 	show_board(nextBoard)


# myBoard = Board.start_position()
# myBoard.set_move(0)
# myBoard.set_move(5)
# show_board(myBoard)

# for idx, _ in enumerate(myBoard.get_moves()):
# 	nextBoard = myBoard.copy()
# 	nextBoard.set_move(idx)
# 	show_board(nextBoard)

# myBoard = Board.start_position()
# myBoard.set_move(0)
# myBoard.set_move(5)
# myBoard.set_move(10)
# show_board(myBoard)

# for idx, _ in enumerate(myBoard.get_moves()):
# 	nextBoard = myBoard.copy()
# 	nextBoard.set_move(idx)
# 	show_board(nextBoard)

#### CHECK ALL WINNING POSITIONS

N = 16 ** 4

# permute ones and zeros according to the following principles
## -> array has to sum to 4
## -> array has to have all zeros at starting bits
## -> white and black arrays can not have a bit at the same position

zeroArr = np.zeros(24, dtype = bool)

### make permutation indices
one_idxs = np.arange(0, 16) + 8
one_grid = np.meshgrid(one_idxs, one_idxs, one_idxs, one_idxs)
cnc_grid = np.stack(one_grid, axis = -1)
cnc_arr = cnc_grid.reshape(N, 4)

### make tiled arrays
permArr = np.tile(zeroArr, (N, 1))

for idx, perms in enumerate(cnc_arr):
	permArr[idx][perms] = True

### filter out dupls
permArr = np.unique(permArr, axis = 0)
permArr = permArr[permArr.sum(axis = 1) == 4]
permArr.shape

outList = []
for perm in permArr:
	### check if any of the True's are already taken up
	perm_filter = permArr[:, perm].sum(axis = 1) == 0
	permArr_filt = permArr[perm_filter]
	num = perm_filter.sum()
	### broadcast and fill in
	permArr_orig = np.tile(perm, (num, 1))
	permArr_joint = np.stack([permArr_orig, permArr_filt], axis = -1)

	outList.append(permArr_joint)

outArr = np.concatenate(outList)

from octagon import WINNING

checkArr = outArr[:, 8:]
checkArr_white = checkArr[:, :, 0]
checkArr_black = checkArr[:, :, 1]

winArr_white = checkArr_white[:, np.newaxis] & WINNING[np.newaxis]
winArr_black = checkArr_black[:, np.newaxis] & WINNING[np.newaxis]

white_win_filter = (winArr_white.sum(axis = 2) == 4).any(axis = 1)
black_win_filter = (winArr_black.sum(axis = 2) == 4).any(axis = 1)

white_win_positions = outArr[white_win_filter]
black_win_positions = outArr[black_win_filter]

for idx in range(24):
	pos = idx * num 
	whiteArr, blackArr = white_win_positions[pos, :, 0], white_win_positions[pos, :, 1]
	myBoard = Board(whiteArr, blackArr, turn = 'b')
	show_board(myBoard)

#######
def check_move(myBoard):
	succs = myBoard.get_successors()
	for board in succs:
		if board.win == myBoard.turn:
			return board
	else:
		


		return np.random.choice(succs)

myBoard = Board.start_position()
while myBoard.win == 0:
	show_board(myBoard)
	myBoard = check_move(myBoard)
else:
	show_board(myBoard)

nextBoard.turn

# class Player:
# 	def __init__(myBoard, is_first)

# class Engine: ### 
