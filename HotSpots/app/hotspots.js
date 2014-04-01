/*
 * Copyright © 2014 Cees van Altena (https://github.com/Cezus/hotspots.js)
 * Licensed under the MIT (https://github.com/Cezus/hotspots.js/license.html) license.
 * Date: 2014-04-01
*/

function HotSpots(drawingAreaId, elementSelectorWithExistingPath, options) {
    this.Defaults = {
        isInEditMode: false,
        drawingAreaId: drawingAreaId,
        elementSelectorWithExistingPath: elementSelectorWithExistingPath,
        newDrawPathLayout: { stroke: 'red', 'stroke-width': 2, fill: '#147EDB', opacity: 0.7 },
        newDrawMouseMovePathLayout: { stroke: 'red', 'stroke-width': 1, fill: '#147EDB', opacity: 0.3 },
        drawnPathLayout: { stroke: 'black', 'stroke-width': 1, fill: '#147EDB', opacity: 0.5 },
        selectedPathLayout: { stroke: 'blue', 'stroke-width': 7, fill: '#DB1462', opacity: 0.5 },
        pathHoverInLayout: { fill: 'red' }
    };

    this.Settings = $.extend({}, this.Defaults, options)

    this.DrawingArea = null;
    this.NewDrawPath = null;
    this.NewDrawPathMouseMove = null;
    this.DrawnCircle = null;
    this.NumberPaths = 0;
    this.OldEditPathValue = null;
    this.SelectedPath = null;
}

HotSpots.prototype = {
    Start: function () {
        // Instantiate the drawing area.
        this.DrawingArea = Raphael(this.Settings.drawingAreaId, $('#' + this.Settings.drawingAreaId).width(), $('#' + this.Settings.drawingAreaId).height());

        this.NewDrawPath = this.DrawingArea.path();
        this.NewDrawPath.node.id = "new_path";
        this.NewDrawPath.attr(this.Settings.newDrawPathLayout);

        var that = this;
        $(this.Settings.elementSelectorWithExistingPath).each(function () {
            that.NumberPaths++;
            var id = "polygon_" + that.NumberPaths;
            $(this).attr('data-polygonid', id);
            var path = $(this).val();

            if (path.match(/M[0-9]{1,3},/gi)) {
                that.AddAndDrawPath(id, path);
            }
        });

        if (this.Settings.isInEditMode) {
            this.EnableEditMode();
        }
        else {
            this.DisableEditMode();
        }

        this.WireEvents();
    },
    DrawAreaOnMouseMove: function (event) {
        if (!this.Settings.isInEditMode || this.NewDrawPath.attr('path').length < 1) {
            return;
        }

        if (this.NewDrawPathMouseMove === null) {
            this.NewDrawPathMouseMove = this.DrawingArea.path(this.NewDrawPath.attr('path'));
            this.NewDrawPathMouseMove.node.id = "new_path";
            this.NewDrawPathMouseMove.attr(this.Settings.newDrawMouseMovePathLayout);
        }

        // Use Math.round to round to integers because the server wants integers but firefox makes floats
        var x = Math.round(event.pageX === undefined ? event.x : event.pageX - $('#' + this.Settings.drawingAreaId).offset().left);
        var y = Math.round(event.pageY === undefined ? event.y : event.pageY - $('#' + this.Settings.drawingAreaId).offset().top);

        var newPath = this.NewDrawPath.attr('path') + ' ' + x + ' ' + y;
        this.NewDrawPathMouseMove.attr({ path: newPath });
    },
    DrawAreaOnClick: function (event) {
        if (!this.Settings.isInEditMode) {
            var $notInEditModeEvent = $.Event("notInEditMode.error.hotspots", {
                message: 'Er is nog niet gestart met tekenen.'
            });

            $('#' + this.Settings.drawingAreaId).trigger($notInEditModeEvent);
            return;
        }

        // Use Math.round to round to integers because the server wants integers but firefox makes floats
        var x = Math.round(event.pageX === undefined ? event.x : event.pageX - $('#' + this.Settings.drawingAreaId).offset().left);
        var y = Math.round(event.pageY === undefined ? event.y : event.pageY - $('#' + this.Settings.drawingAreaId).offset().top);

        var oldpath = this.NewDrawPath.attr('path') + "";
        var newPath = null;
        if (!oldpath.match(/M/) || oldpath.match(/Z/)) {
            newPath = 'M ' + x + ' ' + y;
        } else {
            newPath = oldpath + ' ' + x + ' ' + y;
        }

        var newPoint = { x: x, y: y };

        // Check if path is in other path
        //if (isPathIntersectingWithOtherPath(newPath, newPoint)) {
        //    alert('Een hotspot mag geen andere hotspot overlappen. Teken een andere hotspot.');
        //    return false;
        //}

        this.NewDrawPath.attr({ path: newPath });

        if (this.NewDrawPath.attr('path').length === 1) {
            this.DrawnCircle = this.DrawingArea.circle(newPoint.x, newPoint.y, 5);
            this.DrawnCircle.attr({ fill: 'red' });
        } else {
            this.ClearDrawnCircle();
        }

        var $areaDrawingEvent = $.Event("areaDrawing.hotspots", {
            length: this.NewDrawPath.attr('path').length
        });

        $('#' + this.Settings.drawingAreaId).trigger($areaDrawingEvent);

        return false;
    },
    CloseArea: function () {
        if (!this.Settings.isInEditMode) {
            var $notInEditModeEvent = $.Event("notInEditMode.error.hotspots", {
                message: 'Er is nog niet gestart met tekenen.'
            });

            $('#' + this.Settings.drawingAreaId).trigger($notInEditModeEvent);
            return;
        }

        var path = this.NewDrawPath.attr('path');

        if (path.length < 3) {
            var $drawnPathToShortEvent = $.Event("drawnPathToShort.error.hotspots", {
                message: 'De hotspot die getekend is bevat nog niet genoeg punten. Minimaal 3 punten zijn vereist bij een hotspot.'
            });

            $('#' + this.Settings.drawingAreaId).trigger($drawnPathToShortEvent);
            return;
        }

        var finalizedPath = path + 'Z';

        // Check if finilized polygon is intersecting with other polygon.
        if (this.IsPathIntersecting(finalizedPath)) {
            var $drawnPathIsIntersectingEvent = $.Event("drawnPathIsIntersecting.error.hotspots", {
                message: 'Een hotspot mag geen andere hotspot overlappen. Als we de hotspot afmaken zoals die nu getekend is zal dit het geval zijn, maak de hotspot af zodat de hotspot geen andere hotspot overlapt.'
            });

            $('#' + this.Settings.drawingAreaId).trigger($drawnPathIsIntersectingEvent);
            return;
        }

        this.NewDrawPath.attr({ path: finalizedPath });

        var polygonId = null;

        //if OldEditPathValue has a value then it is a redraw, otherwise it is a new draw
        if (this.OldEditPathValue === null) {
            this.NumberPaths++; //only for new draw, we increase counter so that a new answerbox is added
            polygonId = "polygon_" + this.NumberPaths;

            // Draw this polygon on the image...
            this.AddAndDrawPath(polygonId, finalizedPath);
            var $closeAreaEvent = $.Event("areaClosed.hotspots", {
                areaId: polygonId,
                areaPath: finalizedPath
            });

            $('#' + this.Settings.drawingAreaId).trigger($closeAreaEvent);
        } else {
            polygonId = this.SelectedPath.node.id; //for redraw we keep the existing answer box
            this.UpdatePathValue(polygonId, finalizedPath);
            this.SelectedPath.attr(this.Settings.selectedPathLayout);
        }

        // Empty the user drawn path so that you can draw again
        this.EmptyPath();

        //return {
        //    id: polygonId,
        //    path: finalizedPath,
        //};
        //this.DisableEditMode();
    },
    PathOnClick: function (event, path, hotSpotsUtility) {
        event.stopPropagation();

        var deselectCurrentPath = false;

        if (hotSpotsUtility.SelectedPath !== null) {
            //deselect the old selected item
            hotSpotsUtility.SelectedPath.attr(hotSpotsUtility.Settings.drawnPathLayout);

            //if you clicked on the already selected item, then it should be deselected
            if (hotSpotsUtility.SelectedPath.node.id === path.node.id) {
                deselectCurrentPath = true;
                hotSpotsUtility.SelectedPath = null;

                var $deselectAreaEvent = $.Event("areaDeselected.hotspots", {
                    areaId: path.node.id
                });

                $('#' + hotSpotsUtility.Settings.drawingAreaId).trigger($deselectAreaEvent);
            }
        }

        if (!deselectCurrentPath) {
            path.attr(hotSpotsUtility.Settings.selectedPathLayout);
            //$(this).addClass('selected-area');
            hotSpotsUtility.SelectedPath = path;

            var $selectAreaEvent = $.Event("areaSelected.hotspots", {
                areaId: path.node.id
            });

            $('#' + hotSpotsUtility.Settings.drawingAreaId).trigger($selectAreaEvent);
        }
    },
    EditOnClick: function () {
        if (this.SelectedPath === null) {
            var $noPathSelectedEvent = $.Event("noPathSelected.error.hotspots", {
                message: 'Er is geen hotspot geselecteerd om aan te passen.'
            });

            $('#' + this.Settings.drawingAreaId).trigger($noPathSelectedEvent);
            return;
        }

        this.OldEditPathValue = this.SelectedPath.attr('path'); //preserve the old coordinates in case we want to revert
        this.SelectedPath.attr({ path: '' }); // clear the current selected coordinates for redraw

        if (!this.Settings.isInEditMode) {
            this.EnableEditMode();
        }
    },
    CancelOnClick: function () {
        this.RestoreSelectedPath();
        this.EmptyPath();
        this.DisableEditMode();
    },
    DeleteOnClick: function () {
        if (this.SelectedPath === null) {
            var $noPathSelectedEvent = $.Event("noPathSelected.error.hotspots", {
                message: 'Er is geen hotspot geselecteerd om te verwijderen.'
            });

            $('#' + this.Settings.drawingAreaId).trigger($noPathSelectedEvent);
            return;
        }

        if (this.Settings.isInEditMode) {
            var $deleteWhileInEditModeEvent = $.Event("deleteWhileInEditMode.error.hotspots", {
                message: 'Tijdens tekenen kan geen hotspot verwijderd worden.'
            });

            $('#' + this.Settings.drawingAreaId).trigger($deleteWhileInEditModeEvent);
            return;
        }

        var polygonId = this.SelectedPath.node.id;
        this.DrawingArea.getById(this.SelectedPath.id).remove();

        this.SelectedPath = null;

        var $areaDeletedEvent = $.Event("areaDeleted.hotspots", {
            areaId: polygonId
        });

        $('#' + this.Settings.drawingAreaId).trigger($areaDeletedEvent);
    },
    AddAndDrawPath: function (id, path) {
        var self = this;

        var imagePathOrg = this.DrawingArea.path(path);
        imagePathOrg.attr(this.Settings.drawnPathLayout);
        imagePathOrg.node.id = id;
        imagePathOrg.click(function (e) {
            if (!self.Settings.isInEditMode) {
                self.PathOnClick(e, this, self);
            }
        });


        //if (options) {
        //    imagePathOrg.hover(function () {
        //        alert(options.hover);
        //    });
        //}
        //imagePathOrg.hover(pathOnHoverIn, pathOnHoverOut);
    },
    RestoreSelectedPath: function () {
        if (this.OldEditPathValue !== null && this.SelectedPath !== null) {
            this.SelectedPath.attr({ path: this.OldEditPathValue });

            this.SelectedPath.attr(this.Settings.selectedPathLayout);
        }
    },
    UpdatePathValue: function (id, path) {
        var elementsToUpdate = this.DrawingArea.set();

        this.DrawingArea.forEach(function (element) {
            if (element.node.tagName === "path" && element.node.id === id) {
                element.attr({ path: path })
            }
        });

        var $areaUpdatedEvent = $.Event("areaUpdated.hotspots", {
            areaId: id,
            areaPath: path
        });

        $('#' + this.Settings.drawingAreaId).trigger($areaUpdatedEvent);
    },
    EmptyPath: function () {
        this.NewDrawPath.attr({ path: '' });

        if (this.NewDrawPathMouseMove !== null) {
            this.NewDrawPathMouseMove.attr({ path: '' });
        }

        this.ClearDrawnCircle();

        this.OldEditPathValue = null;
    },
    DisableEditMode: function () {
        this.Settings.isInEditMode = false;
        $('#' + this.Settings.drawingAreaId).removeClass('hotspot-edit-mode');
    },
    EnableEditMode: function () {
        this.Settings.isInEditMode = true;
        $('#' + this.Settings.drawingAreaId).addClass('hotspot-edit-mode');
    },
    ClearDrawnCircle: function () {
        if (this.DrawnCircle !== null) {
            this.DrawingArea.getById(this.DrawnCircle.id).remove();
            this.DrawnCircle = null;
        }
    },
    IsPathIntersecting: function (path, newPoint) {
        var isPointInExistingPolygon = false;
        var that = this;
        this.DrawingArea.forEach(function (element) {
            if (element.node.tagName !== "path") {
                // We are checking not against an path so don't check intersection with this element.
                return;
            }

            if (element.node.id === "new_path") {
                // This is the path we are drawing so don't check intersection with this path.
                return;
            }

            var intersectionNumbers = that.DrawingArea.raphael.pathIntersectionNumber(element.attr('path'), path);
            if (intersectionNumbers !== 0) {
                isPointInExistingPolygon = true;
                return;
            }

            if (newPoint === undefined || newPoint.x === undefined || newPoint.y === undefined) {
                return;
            }

            var polygon = that.Helpers.SvgPathToPolygon(element.attr('path'));

            if (that.Helpers.IsPointInPolygon(polygon, newPoint)) {
                isPointInExistingPolygon = true;
                return;
            }
        });

        return isPointInExistingPolygon;
    },
    IsPathSelected: function () {
        return this.SelectedPath !== null
    },
    WireEvents: function () {
        var self = this;

        $('#' + self.Settings.drawingAreaId).on('click', function (event) {
            self.DrawAreaOnClick(event);
        });

        $('#' + self.Settings.drawingAreaId).on('mousemove', function (event) {
            self.DrawAreaOnMouseMove(event);
        });
    },
    Helpers: { // functions met op zich zelf staand programmatuur, ondersteunende betekenis.
        SvgPathToPolygon: function (svgPath) {
            var poly = [];

            for (var i = 0, len = svgPath.length; i < len; ++i) {
                if (svgPath[i][1] !== undefined && svgPath[i][2] !== undefined) {
                    poly[i] = {};
                    poly[i].x = svgPath[i][1];
                    poly[i].y = svgPath[i][2];
                }
            }

            return poly;
        },
        IsPointInPolygon: function (poly, ptx, pty) {
            //De variabele pt is een object met properties x en y met de coördinaten van de aangeklikte locatie.
            var pt = { x: ptx, y: pty };
            for (var c = false, i = -1, l = poly.length, j = l - 1; ++i < l; j = i)
                ((poly[i].y <= pt.y && pt.y < poly[j].y) || (poly[j].y <= pt.y && pt.y < poly[i].y))
                    && (pt.x < (poly[j].x - poly[i].x) * (pt.y - poly[i].y) / (poly[j].y - poly[i].y) + poly[i].x)
                    && (c = !c);
            return c;
        }
    }
}