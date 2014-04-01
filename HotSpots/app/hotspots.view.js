/*
 * Copyright © 2014 Cees van Altena (https://github.com/Cezus/hotspots.js)
 * Licensed under the MIT (https://github.com/Cezus/hotspots.js/license.html) license.
 * Date: 2014-04-01
*/

(function ($) {
    var self = {};
    self.ExistingHotspotList = '#existing-hotspot-list .hotspot-path input';
    self.DrawingArea = 'drawing-area';
    self.HotSpots = new HotSpots(self.DrawingArea, self.ExistingHotspotList);
    self.HotSpots.Start();
    self.HotSpotsOrdinal = $('#existing-hotspot-list').children().length;

    $(self.ExistingHotspotList).each(function (index, element) {
        $(element).attr('id', 'polygon_' + ++index + '-hotspot');
    });

    $('#start-drawing').on('click', function () {
        self.HotSpots.EnableEditMode();

        if ($('#during-draw-buttons').is(':hidden')) {
            $('#new-draw-buttons').slideUp(function () {
                $('#during-draw-buttons').slideDown();
            });
        }

        $('#close-drawing').prop('disabled', true);
    });

    $('#close-drawing').on('click', function (event) {
        self.HotSpots.CloseArea(event);
    });

    $('#cancel-drawing').on('click', function (event) {
        // geen cursor meer.
        self.HotSpots.CancelOnClick();

        if (self.HotSpots.IsPathSelected()) {
            if ($('#edit-draw-buttons').is(':hidden')) {
                $('#during-draw-buttons').slideUp(function () {
                    $('#edit-draw-buttons').slideDown();
                });
            }
        }
        else {
            if ($('#new-draw-buttons').is(':hidden')) {
                $('#during-draw-buttons').slideUp(function () {
                    $('#new-draw-buttons').slideDown();
                });
            }
        }
    });

    $('#remove-drawing').on('click', function () {
        self.HotSpots.DeleteOnClick();
    });

    $('#edit-drawing').on('click', function () {
        self.HotSpots.EditOnClick();

        if ($('#during-draw-buttons').is(':hidden')) {
            $('#edit-draw-buttons').slideUp(function () {
                $('#during-draw-buttons').slideDown();
            });
        }
    });

    $('#reset-drawing').on('click', function () {
        $('svg').remove();
        $('#existing-hotspot-list').children().each(function (index, hotspot) {
            if (!$(hotspot).find('.hotspot-id').val()) {
                $(hotspot).remove();
            }
        });

        if ($('#new-draw-buttons').is(':hidden')) {
            $('#during-draw-buttons').slideUp(function () {
                $('#new-draw-buttons').slideDown();
            });
        }

        $('#reset-drawing').hide();

        self.HotSpots = new HotSpots(self.DrawingArea, self.ExistingHotspotList);
        self.HotSpots.Start();
        $.fancybox.update();
    });

    $('#drawing-area').on('areaDrawing.hotspots', function (event) {
        if (event.length > 2) {
            $('#close-drawing').prop('disabled', false);
        }
        else {
            $('#close-drawing').prop('disabled', true);
        }
    });

    $('#drawing-area').on('areaClosed.hotspots', function (event) {
        if (event !== undefined) {
            if ($('#new-draw-buttons').is(':hidden')) {
                $('#during-draw-buttons').slideUp(function () {
                    $('#new-draw-buttons').slideDown();
                });
            }

            // Do some HTML DOM magic to add a new box for entering information about the currently closed polygon.
            // Example code for getting a new view to inject in the DOM:
            // Parse view to HTML.
            var html = $.parseHTML(' <div class="well well-small hotspot-editor"> <input class="hotspot-id" data-val="true" data-val-number="The field HotSpotId must be a number." id="HotSpots-0-HotSpotId" name="HotSpots[0].HotSpotId" type="hidden" value=""> <div class="hotspot-path"><input id="polygon_1-hotspot" name="HotSpots[0].Path" type="hidden" value="M229,86L267,181L403,203L391,81Z" data-polygonid="polygon_1"></div> <div class="hotspot"> New hotspot: </div> <div class="hotspot-info"> <div class="editor-label"> <label>Titel</label> </div> <div class="editor-field"> <input type="text" name="HotSpots[0].HotSpotTitle" value="Bee" /> </div> </div> </div>');

            var prefix = 'HotSpots[' + self.HotSpotsOrdinal + '].';
            var prefixId = 'HotSpots-' + self.HotSpotsOrdinal + '-';

            // Make ID's of DOM elements unique and alter the 'name' attribute 
            $(html).find('#HotSpotId').attr('id', prefixId + 'HotSpotId').attr('name', prefix + 'HotSpotId');
            $(html).find('#HotSpotTitel').attr('id', prefixId + 'HotSpotTitel').attr('name', prefix + 'HotSpotTitel');
            $(html).find('input').attr('name', prefix + 'HotSpotTitle');

            // Inject new hotspot path.
            $(html).find('.hotspot-path').empty().append($('<input/>', {
                'id': event.areaId + '-hotspot',
                'name': prefix + 'Path',
                'type': 'hidden',
                'value': event.areaPath,
                'data-polygonid': event.areaId
            }));
            $('#existing-hotspot-list').append(html);
            self.HotSpotsOrdinal++;


            self.HotSpots.DisableEditMode();
            $('#reset-drawing').show();
        }
    });

    $('#drawing-area').on('areaSelected.hotspots', function (event) {
        if ($('#edit-draw-buttons').is(':hidden')) {
            $('#new-draw-buttons').slideUp(function () {
                $('#edit-draw-buttons').slideDown();
            });
        }

        $('.well-current').removeClass('well-current');
        $('#' + event.areaId + '-hotspot').parent().parent().addClass('well-current');
    });

    $('#drawing-area').on('areaDeselected.hotspots', function (event) {
        if ($('#new-draw-buttons').is(':hidden')) {
            $('#edit-draw-buttons').slideUp(function () {
                $('#new-draw-buttons').slideDown();
            });
        }

        $('#' + event.areaId + '-hotspot').parent().parent().removeClass('well-current');
    });

    $('#drawing-area').on('areaDeleted.hotspots', function (event) {
        $('#' + event.areaId + '-hotspot').parent().parent().remove();

        $('.hotspot-editor').each(function (index, hotSpotEditor) {
            $(hotSpotEditor).find("input[name],select[name]").each(function (formItemIndex, formItem) {
                $formItem = $(formItem);
                var newName = $formItem.attr("name").replace(/\[[0-9]{1,}\]\./gi, "[" + index + "].");
                $formItem.attr("name", newName);
            });
        });

        if ($('#new-draw-buttons').is(':hidden')) {
            $('#edit-draw-buttons').slideUp(function () {
                $('#new-draw-buttons').slideDown();
            });
        }

        if ($('#existing-hotspot-list').children().length == 0) {
            $('#reset-drawing').hide();
        }
    });

    $('#drawing-area').on('areaUpdated.hotspots', function (event) {
        $('.hotspot-editor input[data-polygonid="' + event.areaId + '"]').val(event.areaPath);
        self.HotSpots.DisableEditMode();

        if (self.HotSpots.IsPathSelected) {
            if ($('#edit-draw-buttons').is(':hidden')) {
                $('#during-draw-buttons').slideUp(function () {
                    $('#edit-draw-buttons').slideDown();
                });
            }
        }
        else {
            if ($('#new-draw-buttons').is(':hidden')) {
                $('#during-draw-buttons').slideUp(function () {
                    $('#new-draw-buttons').slideDown();
                });
            }
        }
    });

    $('#new-image').on('click', function () {
        $('#upload-hotspot-image .editor-label').after($('<input />', {
            'type': 'file',
            'id': 'HotSpotsUploadedAfbeelding',
            'name': 'HotSpotsUploadedAfbeelding',
            'value': 'ActionHandlerForForm'
        }));

        if ($('#upload-hotspot-image').is(':hidden')) {
            $('#hotspots-area').slideUp(function () {
                $('#upload-hotspot-image').slideDown();
            });
        }

        if ($('#upload-hotspot-image').is(':hidden')) {
            $('#existing-hotspot-list').slideUp();
        }
    });

    $('#cancel-new-image').on('click', function () {
        if ($('#hotspots-area').is(':hidden')) {
            $('#upload-hotspot-image').slideUp(function () {
                $('#hotspots-area').slideDown();
            });
        }

        if ($('#hotspots-area').is(':hidden')) {
            $('#existing-hotspot-list').slideDown();
        }

        $('#HotSpotsUploadedAfbeelding').remove();
    });
}(jQuery));