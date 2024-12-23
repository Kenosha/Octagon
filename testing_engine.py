
from octagon import Board, BoardViz, board_to_indices, arr_to_indices, WINNING
from shapes import BGRFrame, Point2D, Line
import numpy as np

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

#######
def check_move(myBoard): ### a simple engine: makes a move if it is winning; if there are no winning moves, makes a random move.
	succs = myBoard.get_successors()
	for board in succs:
		if board.win == myBoard.turn:
			return board
	else:
		return np.random.choice(succs)

myBoard = Board.start_position()

def eval_next(myBoard):
	succs = myBoard.get_successors()

	if myBoard.turn == 'w':
		ownArrs = [nextBoard.whiteArr[8:] for nextBoard in succs]
	else:
		ownArrs = [nextBoard.blackArr[8:] for nextBoard in succs]
	
	max_values = []
	sum_values = []
	for arr in ownArrs:
		### how many pieces correspond with any of the winning conditions?
		corrArr = (arr & WINNING).sum(axis = 1) # -> if the answer is 4 in any, then we have a winning move!
		max_values.append(corrArr.max())
		sum_values.append(corrArr.sum())

	return np.array(max_values), np.array(sum_values)

def reduce_eval(max_values, sum_values, min_or_max = 'max'):
	npfunc = getattr(np, min_or_max)
	return npfunc(max_values), npfunc(sum_values)

def coeff(max_val, exponent = 5):
	### max_val from 0 to 4 -> to what extent do we like 0, 1, 2, 3, 4 stones to be in a winning position?
	norm_val = (max_val / 4)
	return norm_val ** exponent

def eval_move(myBoard, relative_weight = 0.5, decay_weight = 1):
	succs = myBoard.get_successors()

	max_values, sum_values = eval_next(myBoard)
	max_value, sum_value = reduce_eval(max_values, sum_values)

	# could already check here if a winning move is available -> no need to check other stuff!
	if max_value == 4:
		max_idx = np.argmax(max_values)
		return succs[max_idx]

	succ_evals = [reduce_eval(*eval_next(succBoard)) for succBoard in succs]
	max_value_next, sum_value_next = [ev[0] for ev in succ_evals], [ev[1] for ev in succ_evals]
	
	### these are between 0 and 1
	max_coeffs = np.array([coeff(max_val) for max_val in max_values])
	sum_coeffs = np.array([v / sum_value for v in sum_values])
	
	max_coeffs_next = np.array([coeff(max_val) for max_val in max_value_next])
	sum_coeffs_next = np.array([v / sum_value for v in sum_value_next]) 

	comb_coeffs = max_coeffs + relative_weight * sum_coeffs - decay_weight * max_coeffs_next - decay_weight * relative_weight * sum_coeffs_next

	print(comb_coeffs)
	
	if comb_coeffs.sum() == 0:
		max_idx = np.random.choice(len(comb_coeffs))
		return succs[max_idx]
	else:
		max_idx = np.argmax(comb_coeffs)
		return succs[max_idx]

computer_side = 'b'
selPt = None
select_mode = True
target_mode = False
myBoard = Board.start_position()
myViz = BoardViz(myBoard, dim = 1000)

brdFrm = myViz.get_frame()
cv.namedWindow('image')
cv.setMouseCallback('image', select_point)
cv.imshow('image', brdFrm.array)
key = cv.waitKey(0) & 0xFF

while myViz.myBoard.win == 0:
	if myViz.myBoard.turn == computer_side:
		nextBoard = eval_move(myViz.myBoard)
		myViz.myBoard = nextBoard
		selIdx, selPt = None, None
		continue
	else:
		clickPt = Point2D(click_coords)
		if selPt is None:
			selIdx, selPt = myViz.select_piece(clickPt)
		else:
			nextBoard = myViz.select_target(selIdx, clickPt)
			
			if nextBoard is not None: ### a target has been validly selected
				myViz.myBoard = nextBoard
				selIdx, selPt = None, None
			else: ### check if a new selection has been validly made
				selIdx, selPt = myViz.select_piece(clickPt)

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
