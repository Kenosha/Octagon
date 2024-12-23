import pandas as pd
import numpy as np
import cv2 as cv

from dataclasses import dataclass
from typing import Optional

def show(frame, name = 'frame', num_seconds = None):
    cv.imshow(name, frame)
    keypress = cv.waitKey(0 if num_seconds is None else round(num_seconds * 1000))
    cv.destroyAllWindows()  
    return keypress

def put(someFrm, someObj, 
        color = None, radius = None, thickness = None, where = None, size = None, marker = None, font = None, lineType = None,
        annotation = None, enumeration = False, verbose = False):
    
    if font is None:
        font = cv.FONT_HERSHEY_PLAIN
    if lineType is None:
        lineType = cv.LINE_AA

    offset_margin = 10
    
    if verbose:
        print('Calling put dispatcher with keywords')
        print(f'    color = {color}, radius = {radius}, thickness = {thickness}, where = {where}, size = {size}')
        
    InstClass = someFrm.__class__
    self_copy = someFrm.array.copy() # to preverve immutability of frame
    
    if someObj is None:
        return someFrm
    
    if someObj.__class__.__name__ == 'Point2D':
        if verbose: print('Point2D!')
        if marker is None:
            myFrm = InstClass(cv.circle(self_copy, someObj.round_coords(), radius, color, thickness))
        else:
            myFrm = InstClass(cv.drawMarker(self_copy, someObj.round_coords(), color, markerType = marker, markerSize = size, thickness = thickness))
        if annotation is not None:
            myFrm = myFrm.put(str(annotation), where = (someObj - offset_margin).coords)
        return myFrm
    
    if someObj.__class__.__name__ == 'Line':
        if verbose: print('Line!')
        c1, c2 = someObj.leftPt.round_coords(), someObj.rightPt.round_coords()
        myFrm = InstClass(cv.line(self_copy, c1, c2, color, thickness))
        if annotation is not None:
            myFrm = myFrm.put(str(annotation), where = (someObj.leftPt - offset_margin).coords)
        return myFrm
    
    if isinstance(someObj, str):
        if verbose: print('String!')
        ### Determine text height, to be able to offset
        text_size, _ = cv.getTextSize(someObj, font, size, thickness)
        line_offset = text_size[1] + 5
        
        text_lines = someObj.split('\n')
        for idx, ln in enumerate(text_lines):
            # ln = ln.strip(' ')
            x, y = where
            y += idx * line_offset

            cv.putText(self_copy, ln, (x, y), font, size, color, thickness, lineType)
            
        return InstClass(self_copy)
    
    if isinstance(someObj, list):
        if verbose: print('List!')
        if len(someObj) == 0:
            return someFrm
        else:
            p, ps = someObj[0], someObj[1:]
            currFrm = put(someFrm, p, color = color, radius = radius, thickness = thickness, where = where, size = size,
                          annotation = annotation)
            new_annotation = annotation + 1 if annotation is not None else None
            return put(currFrm, ps, color = color, radius = radius, thickness = thickness, 
                       where = where, size = size, annotation = new_annotation)
            
    if verbose: print('Not Any Type!')
    return someFrm ### if any other entry type --> we can't display it, so we just return original frame, instead of None
    ####################

@dataclass(frozen = True)
class Point2D:
    """
    A point: tuple of integers, signifying x and y coordinates.
    """   
    coords: tuple
    value: Optional[None] = None
    
    def __post_init__(self):
        #### IMMUTABILITY BREAKS ####
        object.__setattr__(self, 'x', self.coords[0])
        object.__setattr__(self, 'y', self.coords[1])
        #############################  
        
    ### ARITHMETIC ###
    @staticmethod      
    def get_operant(op):
        try: 
            op_x, op_y = op.coords
        except:
            op_x, op_y = op, op
        finally:
            return op_x, op_y    
    
    def __add__(self, y):
        op_x, op_y = Point2D.get_operant(y)
        outCoords = self.coords[0] + op_x, self.coords[1] + op_y
        return Point2D(outCoords)
    def __sub__(self, y):
        op_x, op_y = Point2D.get_operant(y)
        outCoords = self.coords[0] - op_x, self.coords[1] - op_y
        return Point2D(outCoords)
    def __mul__(self, y):
        op_x, op_y = Point2D.get_operant(y)
        outCoords = self.coords[0] * op_x, self.coords[1] * op_y
        return Point2D(outCoords)
    def __floordiv__(self, y):
        op_x, op_y = Point2D.get_operant(y)
        outCoords = self.coords[0] // op_x, self.coords[1] // op_y
        return Point2D(outCoords)
    def __truediv__(self, y): ### this does not guarantee a safe point!
        op_x, op_y = Point2D.get_operant(y)
        outCoords = self.coords[0] / op_x, self.coords[1] / op_y
        return Point2D(outCoords)
    
    ### METHODS ###
    def up(self, points):
        return Point2D((self.x, max(self.y - points, 0)))

    def down(self, points):
        return Point2D((self.x, self.y + points))

    def left(self, points):
        return Point2D((max(self.x - points, 0), self.y))

    def right(self, points):
        return Point2D((self.x + points, self.y))
    
    def distance_to(self, aPt):
        x_dist_64 = int(self.x - aPt.x) ### to prevent overflow when squaring.
        y_dist_64 = int(self.y - aPt.y) ### to prevent overflow when squaring.
        res = (x_dist_64 ** 2 + y_dist_64 ** 2) ** 0.5
        return res
    
    def conform_to(self, image):
        # force the point to be in bounds
        corr_x = min(max(0, self.x), image.cols - 1)
        corr_y = min(max(0, self.y), image.rows - 1)
        return Point2D((corr_x, corr_y))
    
    def project_vertically(self, aLn):
        new_x = self.x
        new_y = aLn.weak_y(self.x)
        if not new_y is None:
            return Point2D((new_x, new_y))
    
    def project_horizontally(self, aLn):
        new_x = aLn.weak_x(self.y)
        new_y = self.y
        if not new_x is None:
            return Point2D((new_x, new_y))
        
    def flip_vertically(self, aLn):
        """
        Flip vertically across a line by projecting onto it and mirroring distance on other side.
        """
        projPt = self.project_vertically(aLn)
        if not projPt is None:
            new_x = self.x
            new_y = projPt.y + (projPt.y - self.y)
            return Point2D((new_x, new_y))
    
    def flip_horizontally(self, aLn):
        """
        Flip horizontally across a line by projecting onto it and mirroring distance on other side.
        """
        projPt = self.project_horizontally(aLn)
        if not projPt is None:
            new_x = projPt.x + (projPt.x - self.x)
            new_y = self.y
            return Point2D((new_x, new_y))
    
    def apply_homography(self, H):
        """
        Apply a 3x3 homography matrix H to a point.        
        """
        _epsilon = 10 ** -5 # a small number, to approximate points at infinity
        hom_coords = np.matmul(H, [self.x, self.y, 1])
        try:
            norm_coords = hom_coords[:2] / hom_coords[2]
        except:
            ### figure out the scale of the first two coords, so we can approximate the point at infinity
            _smaller = max(min(hom_coords[:2]), 1) ### we're only worried about very small coords, hence the maximum condition
            _scale = round(np.log10(_smaller)) + 1
            norm_coords = hom_coords[:2] / (_epsilon ** _scale)
        return Point2D(tuple(norm_coords))
    
    def is_left(self, inObj):
        if isinstance(inObj, Point2D):
            comp = inObj.x
        else:
            comp = inObj
        return self.x < comp
    
    def is_right(self, inObj):
        if isinstance(inObj, Point2D):
            comp = inObj.x
        else:
            comp = inObj
        return self.x > comp
    
    def is_above(self, inObj):
        if isinstance(inObj, Point2D):
            comp = inObj.y
        else:
            comp = inObj
        return self.y < comp
    
    def is_below(self, inObj):
        if isinstance(inObj, Point2D):
            comp = inObj.y
        else:
            comp = inObj
        return self.y > comp

    def round_coords(self):
        x, y = self.coords
        return (round(x), round(y))
    
    def round_point(self):
        return Point2D(self.round_coords(), value = self.value)
        
    def within(self, myReg):
        tl, tr, bl, br = myReg.to_points()
        if self.is_right(tl) and self.is_below(tl) and self.is_left(br) and self.is_above(br):
            return True
        else:
            return False
        
    def bind_below(self, bound):
        x, y = self.coords
        return Point2D((max(x, bound), max(y, bound)))
    
    def bind_above(self, bound):
        x, y = self.coords
        return Point2D((min(x, bound), min(y, bound)))
        
    def find_perpendicular(self):
        #### interpret a point as a vector, and find one (of two) perpendicular vectors
        v1, v2 = self.coords
        return Point2D((-v2, v1))
    
    def rescale(self, scale_factor):
        return (self * scale_factor).round_point()
    

@dataclass(frozen = True)
class Line:
    """
    A line between two points
    """
    leftPt: Point2D
    rightPt: Point2D
    
    name: str = 'Line'
    
    def __post_init__(self):
        
        ### make it so that lines always go from left to right. 
        # If there is a tie, they go from up to down.
        _reinst = False
        l, r = self.leftPt, self.rightPt
        if not l.is_left(r):
            if not l.is_right(r):
                ### same x coord!
                if l.is_below(r):
                    _reinst = True
            else:
                _reinst = True
        if _reinst:
            object.__setattr__(self, 'leftPt', r)
            object.__setattr__(self, 'rightPt', l)
            
    
    ### CONSTRUCTORS ###
    @staticmethod
    def from_coords(four_coords, name = 'Line'):
        x1, y1, x2, y2 = four_coords
        return Line(Point2D((x1, y1)), Point2D((x2, y2)), name = name)
    
    @staticmethod
    def from_series(lnSer):
        x1 = lnSer.loc['x1']
        y1 = lnSer.loc['y1']
        x2 = lnSer.loc['x2']
        y2 = lnSer.loc['y2']
        leftPt = Point2D((x1, y1))
        rightPt = Point2D((x2, y2))
        return Line(leftPt, rightPt, name = lnSer.name)
    
    ### ARITHMETIC ###
    def __mul__(self, y):
        InstClass = self.__class__
        new_leftPt, new_rightPt = self.leftPt * y, self.rightPt * y
        return InstClass(new_leftPt, new_rightPt, name = self.name)
    
    def left_point(self):
        if self.leftPt.is_left(self.rightPt):
            return self.leftPt
        else:
            return self.rightPt
    
    def right_point(self):
        if self.leftPt.is_right(self.rightPt):
            return self.leftPt
        else:
            return self.rightPt
        
    def low_point(self):
        if self.leftPt.is_below(self.rightPt):
            return self.leftPt
        else:
            return self.rightPt
    
    def high_point(self):
        if self.leftPt.is_above(self.rightPt):
            return self.leftPt
        else:
            return self.rightPt
            
    def is_horizontal(self):
        return abs(self.rightPt.x - self.leftPt.x) > abs(self.rightPt.y - self.leftPt.y)
    
    def is_vertical(self):
        return not self.is_horizontal()
    
    def is_weakly_left(self, x_of_int: int):
        return self.left_point().is_left(x_of_int)
    def is_weakly_right(self, x_of_int: int):
        return self.right_point().is_right(x_of_int)
    def is_weakly_above(self, y_of_int: int):
        return self.high_point().is_above(y_of_int)
    def is_weakly_below(self, y_of_int: int):
        return self.low_point().is_below(y_of_int)
    
    def is_strictly_left(self, x_of_int: int):
        return self.right_point().is_left(x_of_int)
    def is_strictly_right(self, x_of_int: int):
        return self.left_point().is_right(x_of_int)
    def is_strictly_above(self, y_of_int: int):
        return self.low_point().is_above(y_of_int)
    def is_strictly_below(self, y_of_int: int):
        return self.high_point().is_below(y_of_int)
    # note that as opposed to the points (with the exception of points on the line), 
    # the complement of lines to the left of x is not all lines to the right of x, due to the OR! 
    # hence we need meaningful separate methods for is_right and is_below

    ### METHODS ###
    def up(self, points, name = None):
        if name is None:
            name = self.name
        return Line(self.leftPt.up(points), self.rightPt.up(points), name = name)

    def down(self, points, name = None):
        if name is None:
            name = self.name
        return Line(self.leftPt.down(points), self.rightPt.down(points), name = name)

    def left(self, points, name = None):
        if name is None:
            name = self.name
        return Line(self.leftPt.left(points), self.rightPt.left(points), name = name)

    def right(self, points, name = None):
        if name is None:
            name = self.name
        return Line(self.leftPt.right(points), self.rightPt.right(points), name = name)

    def length(self):
        return self.leftPt.distance_to(self.rightPt)

    def slope(self):
        denom = (self.rightPt.x - self.leftPt.x)
        if denom == 0:
            return None
        else:
            try:
                slp = (self.rightPt.y - self.leftPt.y) / denom
            except:
                slp = None
            finally:
                return slp
            
    def intercept(self):
        slp = self.slope()
        if slp is None:
            return None
        else:
            return self.leftPt.y - slp * self.leftPt.x
        
    def weak_intersect(self, bLn, to_int = True):
        """
        Intersect lines self and bLn, allowing for infinite extension of lines.
        The only time this will NOT yield a result is for parallel lines.       
        We do not distinguish between parallel identical and parallel non-identical lines
        If you need it, implement it.
        """
        slp1, int1 = self.slope(), self.intercept()
        slp2, int2 = bLn.slope(), bLn.intercept()
        
        if slp1 is None and slp2 is None: ### vertical, parallel lines
            return None 
        elif slp1 is None:
            x_int = self.leftPt.x
            y_int = slp2 * x_int + int2
        elif slp2 is None:
            x_int = bLn.leftPt.x
            y_int = slp1 * x_int + int1
        else:
            if slp1 == slp2:
                return None
            else:
                x_int = (int2 - int1) / (slp1 - slp2)
                y_int = slp1 * x_int + int1
                
        if to_int:
            x_int, y_int = round(x_int), round(y_int)
        return Point2D((x_int, y_int))
            
    def weak_y(self, x):
        """
        get y value at x, on the line or beyond.    
        """
        slp, itc = self.slope(), self.intercept()
        if slp is None:
            return None
        else:
            return slp * x + itc

    def weak_x(self, y):
        """
        get x value at y, on the line or beyond.    
        """
        slp, itc = self.slope(), self.intercept()
        if slp is None:
            return self.leftPt.x
        else:
            return (y - itc) / slp
        
    def flip_vertically(self, aLn, name = 'Line'):
        if name is None:
            name = f'Flipped {self.name}'
        return Line(self.leftPt.flip_vertically(aLn), self.rightPt.flip_vertically(aLn),
                    name = name)
        
    def flip_horizontally(self, aLn, name = None):
        if name is None:
            name = f'Flipped {self.name}'
        return Line(self.leftPt.flip_horizontally(aLn), self.rightPt.flip_horizontally(aLn), 
                    name = name)
    
    def apply_homography(self, H, name = None):
        if name is None:
            name = self.name
        return Line(self.leftPt.apply_homography(H), self.rightPt.apply_homography(H), name = name)
    
    def round_points(self, name = None):
        if name is None:
            name = self.name
        return Line(self.leftPt.round_point(), self.rightPt.round_point(), name = name)

    def subdivide(self, elements = 100):
        x_space = np.linspace(self.left_point().x, self.right_point().x, num = elements, dtype = 'int32')
        y_space = np.linspace(self.high_point().y, self.low_point().y, num = elements, dtype = 'int32')
        if self.left_point() != self.high_point():
            y_space = np.flip(y_space)
        x_y_space = zip(x_space, y_space)
        return [Point2D(x_y) for x_y in x_y_space]
    
    def join(self, bLn):
        if self.rightPt == bLn.leftPt:
            return Line(self.leftPt, bLn.rightPt)
        elif self.leftPt == bLn.rightPt:
            return Line(bLn.leftPt, self.rightPt)
        
    def center(self):
        return (self.leftPt + self.rightPt) // 2
    
    def distance_to(self, aPt):
        ### find perpendicular distance of a line to a point
        lineVec = self.rightPt - self.leftPt
        orthLine = Line(aPt, aPt + lineVec.find_perpendicular())
        nearestPt = self.weak_intersect(orthLine, to_int = False)
        return aPt.distance_to(nearestPt)
    
    def rescale(self, scale_factor):
        return Line(self.leftPt.rescale(scale_factor), self.rightPt.rescale(scale_factor), name = self.name)
    
 
@dataclass(frozen = True)
class Frame:
    array: np.ndarray
    name: str = 'frame'
    
    def __post_init__(self):
        #### IMMUTABILITY BREAKS ####
        object.__setattr__(self, 'rows', self.array.shape[0])
        object.__setattr__(self, 'cols', self.array.shape[1])
        object.__setattr__(self, 'shape', self.array.shape)
        object.__setattr__(self, 'size', self.rows * self.cols)
        
        if len(self.array.shape) == 1:
            object.__setattr__(self, 'array', np.array([self.array]))
        
        try:
            channels = self.array.shape[2]
        except:
            channels = 1
    
        object.__setattr__(self, 'channels', channels)
        
        #############################  
    
    @staticmethod       
    def dispatch_arithmetic(x, y, func, *args, **kwargs):
        try:
            outArr = func(x, y, *args, **kwargs)
        except TypeError:
            outArrs = [func(chImg, chVal, *args, **kwargs) for chImg, chVal in zip(cv.split(x), y)] ### if y is a list: we subtract channels one-by-one
            outArr = cv.merge(outArrs)
        return outArr
    
    @staticmethod      
    def get_operant(op):
        try: 
            operant = op.array
        except:
            operant = op
        finally:
            return operant    
        
    def __add__(self, y):
        InstClass = self.__class__
        outArr = Frame.dispatch_arithmetic(self.array, Frame.get_operant(y), cv.add)
        return InstClass(outArr)
    def __sub__(self, y):
        InstClass = self.__class__
        outArr = Frame.dispatch_arithmetic(self.array, Frame.get_operant(y), cv.absdiff)
        return InstClass(outArr)
    def __truediv__(self, y):
        InstClass = self.__class__
        outArr = Frame.dispatch_arithmetic(self.array, Frame.get_operant(y), cv.divide)
        return InstClass(outArr)
    
    def __mod__(self, y):
        InstClass = self.__class__
        outArr = np.mod(self.array, Frame.get_operant(y))
        return InstClass(outArr)
    
    def __mul__(self, y):
        return Frame(self.array.astype(float) * Frame.get_operant(y))
    def __pow__(self, y):
        return Frame(self.array.astype(float) ** y)
    
    ### UTILITY METHODS ###
    def rename(self, new_name):
        return self.__class__(self.array, name = new_name)
    
    ### SHOW METHODS ###
    def show(self, num_seconds = None):
        keypress = show(self.array, name = self.name, num_seconds = num_seconds)
        return keypress

    # def show_continuous(self, ms_between_frames = 30, name = 'frame'):
    #     still_showing = show_continuous(self.array, ms_between_frames = ms_between_frames, name = name)
    #     return still_showing

    def unique(self):
        return np.unique(self.array)

    def eval_at(self, point: Point2D):
        point = point.conform_to(self)
        return self.array[point.y, point.x]
    
    def fast_eval_at(self, point: Point2D):
        return self.array[point.y, point.x]
    
    def maybe_eval_at(self, point: Point2D):
        try:
            return self.array[point.y, point.x]
        except IndexError:
            return None
    
    def mean_std(self, mask = None):
        if mask is not None:
            mask = mask.array
        mean, std = cv.meanStdDev(self.array, mask = mask)
        return mean.squeeze().tolist(), std.squeeze().tolist()
    
    def sum(self, axes):
        return self.array.sum(axes)
    
    def clip_lo(self, y):
        InstClass = self.__class__
        return InstClass(cv.max(self.array, Frame.get_operant(y)))
    def clip_hi(self, y):
        InstClass = self.__class__
        return InstClass(cv.min(self.array, Frame.get_operant(y))) 
    
    def mask(self, boolFrm):
        maskArr = boolFrm.array.astype('uint8') # cv mask does not accept bools
        return Frame(cv.bitwise_and(self.array, self.array, mask = maskArr))
    ###############
        
    def roll(self, how = 'down', shift = 1, nan_sentinel = np.nan):
        if shift < 0:
            raise Exception('Roll with positive shifts only! Give direction via the how keyword!')
        
        axis = 1 if how in ['left', 'right'] else 0
        shift = - shift if how in ['left', 'up'] else shift
            
        if nan_sentinel == np.nan:
            rArr = self.array.astype(float)
        else:
            rArr = self.array
        rArr = np.roll(rArr, axis = axis, shift = shift) 
        
        if how == 'down':
            rArr[:shift] = nan_sentinel # first {shift} rows have to be set to nan ... 
        elif how == 'up':
            rArr[shift:] = nan_sentinel # last {- shift} rows have to be set to nan (note that shift is negative!)
        elif how == 'right':
            rArr[:, :shift] = nan_sentinel # first {shift} columns have to be set to nan 
        elif how == 'left':
            rArr[:, shift:] = nan_sentinel # last {- shift} columns have to be set to nan (note that shift is negative!)
        else:
            raise Exception('Give down, up, right or left as keywords for how in roll method of frame!')
        
        return Frame(rArr)
            
    def zoom(self, zoom_factor, interpolation = cv.INTER_LINEAR):
        InstClass = self.__class__
        self_copy = self.array.copy()
        zoomArr = cv.resize(self_copy, None, 
                            fx = zoom_factor, fy = zoom_factor, interpolation = interpolation)
        return InstClass(zoomArr)

    def gaussian_blur(self, kernelSize):
        self_copy = self.array.copy()
        InstClass = self.__class__
        
        blurArr = cv.GaussianBlur(self_copy, kernelSize, 0)
        return InstClass(blurArr)
    
    def warp(self, H, cols = None, rows = None):
        InstClass = self.__class__
        self_copy = self.array.copy()
        
        if cols is None:
            cols = self.cols
        if rows is None:
            rows = self.rows
        wrpArr = cv.warpPerspective(self_copy, H, (cols, rows))
        return InstClass(wrpArr)
    
    def dim(self, dimming_factor):
        InstClass = self.__class__
        self_copy = self.array.copy()
        
        dimArr = (self_copy * dimming_factor)
        return InstClass(dimArr.astype('uint8'))
    
    def rescale(self, scale_factor):
        InstClass = self.__class__
        self_copy = self.array.copy()
        
        new_width = round(self.cols * scale_factor)
        new_height = round(self.rows * scale_factor)
        dim = (new_width, new_height)
        
        resArr = cv.resize(self_copy, dim, interpolation = cv.INTER_AREA)
        
        return InstClass(resArr.astype('uint8'), name = self.name)
    
    def pad(self, to_height = None, to_width = None, height_how = 'center', width_how = 'center'):
        ### height_how: center, up, down; width_how: center, left, right.
        assert height_how in ['center', 'up', 'down']
        assert width_how in ['center', 'left', 'right']

        InstClass = self.__class__
        self_copy = self.array.copy()
        
        if to_height is None:
            to_height = self.rows
        if to_width is None:
            to_width = self.cols
            
        hdiff = to_height - self.rows
        wdiff = to_width - self.cols
    
        if height_how == 'center':
            hdiv, hmod = hdiff // 2, hdiff % 2
            top_add = hdiv
            bot_add = hdiv + hmod
        elif height_how == 'up':
            top_add = 0
            bot_add = hdiff
        elif height_how == 'down':
            top_add = hdiff
            bot_add = 0

        if width_how == 'center':
            wdiv, wmod = wdiff // 2, wdiff % 2
            left_add = wdiv
            right_add = wdiv + wmod
        elif width_how == 'left':
            left_add = 0
            right_add = wdiff
        elif width_how == 'right':
            left_add = wdiff
            right_add = 0

        outArr = cv.copyMakeBorder(self_copy, top_add, bot_add, left_add, right_add, cv.BORDER_CONSTANT, value = 0)
        
        return InstClass(outArr, name = self.name)
        
@dataclass(frozen = True)
class BGRFrame(Frame):
    array: np.ndarray
    name: str = 'frame'
    
    def __post_init__(self):
        ### call post init of super class
        super(BGRFrame, self).__post_init__()
        
        #### IMMUTABILITY BREAKS ####
        # convert grayscale to a grey BGR
        if len(self.array.shape) == 2:
            object.__setattr__(self, 'array', cv.cvtColor(self.array,  cv.COLOR_GRAY2BGR))
        #############################  
    
    @classmethod
    def get_converter(cls):
        return 'to_BGR'
    @classmethod
    def get_color(cls):
        return 'bgr'
    
    def __repr__(self):
        return f'BGRFrame({self.cols} by {self.rows} by {self.channels}, name: {self.name})'
    ##################     
    
    def put(self, anyObj, 
            color = (0, 255, 0), radius = 1, thickness = 1, where = (50, 50), size = 1, 
            font = None, lineType = None,
            marker = None, annotation = None, enumeration = False,
            verbose = False):
        return put(self, anyObj, 
                   color = color, radius = radius, thickness = thickness, 
                   where = where, size = size, marker = marker, 
                   font = font, lineType = lineType,
                   annotation = annotation, enumeration = enumeration,
                   verbose = verbose)
        
    def zero(self):
        return BGRFrame(np.zeros(self.shape, dtype = 'uint8'))
    
    def mask(self, boolFrm):
        maskArr = boolFrm.array.astype('uint8') # cv mask does not accept bools
        return BGRFrame(cv.bitwise_and(self.array, self.array, mask = maskArr))
    
    def hist(self, channels, normalize = False):
        channelDict = {'B': 0, 'G': 1, 'R': 2}
        
        ### figure out channels
        chnList = []
        binList = []
        rngList = []
        for c in channels:
            chnList.append(channelDict[c])
            binList.append(256)
            rngList.extend([0, 256])
            
        histData = cv.calcHist([self.array], chnList, None, binList, rngList)
        histFrm = pd.DataFrame(histData, dtype = 'int64')
        if normalize:
            histFrm = histFrm / histFrm.sum().sum()
        return histFrm.squeeze()
    ###############
    


