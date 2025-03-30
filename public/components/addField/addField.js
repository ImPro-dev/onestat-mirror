/* eslint-disable no-undef */

'use strict';

$(document).ready(function () {
  var max_fields = 20;
  var $add_input_button = $('.add-input-button');
  var $field_wrapper = $('.fields-wrapper');
  var new_field_html = '<div class="form-control-wrapper custom-file mt-2 text-right w-shorten"><input class="form-control" id="fb_stat_bot" type="file" name="fb_stat" required=""><button class="btn btn-danger btn-sm mt-2 remove-input-button" type="button"><span class="linearicons-trash2"></span></button></div>';
  var input_count = 1;

  //add input
  $add_input_button.on('click', function () {
    if (input_count < max_fields) {
      input_count++;
      $(this).siblings('.fields-wrapper').append(new_field_html);
    }
  });

  //remove_input
  $field_wrapper.on('click', '.remove-input-button', function (e) {
    e.preventDefault();
    $(this).parent('div').remove();
    input_count--;
  });
});

