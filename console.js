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
    const hasErrors = (console.errors.length > 0);
    const hasWarnings = (console.warnings.length > 0);
    if (!hasErrors && !hasWarnings)
      return;

    let options = {
      title: 'Error Alert',
      messageType: 'error'
    };
    let msg = '';
    if (hasErrors) {
      if (hasWarnings)
        msg = 'Errors:\n'
        msg += console.errors.join('\n');
        msg += '\n\nWarnings:\n';
    }

    if (hasWarnings) {
      if (!hasErrors) {
        options.title = 'Warning Alert';
        options.messageType = 'warning';
      }
      msg += console.warnings.join('\n');
    }

    josm.alert(msg, options);

    jsconsole.show();
  }
};

export default console;
