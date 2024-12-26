/*
  Functions:
    - Provide calls similar to the standard ES "console"
    - Accumulate errors and warnings and display a modal JOSM alert
*/

import josm from 'josm';
import * as jsconsole from 'josm/scriptingconsole'


class console {
  static errors = [];
  static warnings = [];

  static clear()
  {
    jsconsole.clear();
    console.errors = [];
    console.warnings = [];
  }

  static show()
  {
    jsconsole.show();
  }

  static log(s)
  {
    jsconsole.println(s);
  }

  static info(s)
  {
    console.log(s);
  }

  static warn(s)
  {
    jsconsole.println('Warning: ' + s);
    console.warnings.push(s);
  }

  static error(s)
  {
    jsconsole.println('Error: ' + s);
    console.errors.push(s);
  }

  static display()
  {
    if (console.errors || console.warnings) {
      let options = {
        title: 'Error Alert',
        messageType: 'error'
      };
      let msg = '';
      if (console.errors.length > 0) {
        if (console.warnings.length > 0)
          msg = 'Errors:\n'
          msg += console.errors.join('\n');
      }

      if (console.warnings.length > 0) {
        if (console.errors.length > 0) {
          msg += '\n\nWarnings:\n';
        } else {
          options.title = 'Warning Alert';
          options.messageType = 'warning';
        }
        msg += console.warnings.join('\n');
      }

      josm.alert(msg, options);

      jsconsole.show();
    }
  }
};

export default console;
