from octagon import Board, BoardViz, board_to_indices, arr_to_indices
from shapes import BGRFrame, Point2D, Line
import numpy as np

P1_NAME = 'Mattheo'
P2_NAME = 'Federico'

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

selPt = None
select_mode = True
target_mode = False
myBoard = Board.start_position()
myBoard.white_name = P1_NAME
myBoard.black_name = P2_NAME
myViz = BoardViz(myBoard, dim = 1200, piece_thickness = 30, text_size = 2, text_where = (50, 50))

brdFrm = myViz.get_frame()
cv.namedWindow('image')
cv.setMouseCallback('image', select_point)
cv.imshow('image', brdFrm.array)
key = cv.waitKey(0) & 0xFF

while myViz.myBoard.win == 0:
	clickPt = Point2D(click_coords)
	
	if selPt is None:
		selIdx, selPt = myViz.select_piece(clickPt)
	else:
		nextBoard = myViz.select_target(selIdx, clickPt)
		nextBoard.white_name = myBoard.white_name
		nextBoard.black_name = myBoard.black_name
		
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
