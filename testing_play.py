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

class BoardViz:
	def __init__(	self, myBoard: Board, dim: int = 600, offset: float = 0.1, 
					line_color = BGR['minty_green'], 
					point_color = BGR['smokey_grey'],
					player_one_color = BGR['intense_red'],
					player_two_color = BGR['strong_blue'],
					point_thickness = 10,
					piece_thickness = 20,
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
		plFrm = plFrm.put(showStr, where = (20, 20))

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

### call back -> register keypress to make a move!
import cv2 as cv
click_coords = None
def select_point(event, x, y, flags, param):
	# grab references to the global variables
	global click_coords
	# if the left mouse button was clicked, record the (x, y) coordinates
	if event == cv.EVENT_LBUTTONDOWN:
		click_coords = (x, y)
		cv.destroyAllWindows()

select_mode = True
target_mode = False
myBoard = Board.start_position()
myViz = BoardViz(myBoard)

brdFrm = myViz.get_frame()
cv.namedWindow('image')
cv.setMouseCallback('image', select_point)
cv.imshow('image', brdFrm.array)
key = cv.waitKey(0) & 0xFF

while myViz.myBoard.win == 0:
	clickPt = Point2D(click_coords)
	
	if selPt is None:
		selIdx, selPt = select_piece(myViz, clickPt)
	else:
		nextBoard = select_target(myViz, selIdx, clickPt)
		
		if nextBoard is not None: ### a target has been validly selected
			myViz.myBoard = nextBoard
			selIdx, selPt = None, None
		else: ### check if a new selection has been validly made
			selIdx, selPt = select_piece(myViz, clickPt)

	brdFrm = myViz.get_frame(selected_point = selPt)

	cv.namedWindow('image')
	cv.setMouseCallback('image', select_point)
	cv.imshow('image', brdFrm.array)
	key = cv.waitKey(0) & 0xFF

	### quit	
	if key == ord('q'): ## press q to quit
		cv.destroyAllWindows()
		break





# class Player:
# 	def __init__(myBoard, is_first)

# class Engine: ### 
