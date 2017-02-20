'use babel'

import { CompositeDisposable, Range } from 'atom'


export default {
  subscriptions: null,

  activate(state) {
    this.subscriptions = new CompositeDisposable()

    // Register command that toggles this view
    this.subscriptions.add(
      atom.workspace.observeTextEditors(editor => {
        editor._undoTreeTransact = editor.transact
        editor.transact = this.transact.bind(editor)
      })
    )
  },

  transact(groupingInterval, fn) {
    const history = this.getBuffer().history
    if (history.redoStack.length) {
      history.undoStack.push(...[...history.redoStack].reverse())
      history.redoStack.map(redo => {
        switch (redo.constructor.name) {
          case "Checkpoint":
            console.log('Got Checkpoint...')
            return
          case "Transaction":
            const Transaction = redo.constructor
            // Copy is necessary here
            redo = new Transaction(
              redo.markerSnapshotAfter,
              redo.patch.invert(),
              redo.markerSnapshotBefore,
              redo.groupingInterval)
              // Hack to prevent groupping
              redo.timestamp = -1
            break
          case "Patch":
            redo = redo.invert()
            break
          default:
            throw new Error(
              "Unexpected entry type when popping undoStack: ",
              redo.constructor.name)
        }
        history.undoStack.push(redo)
      })
    }
    return this._undoTreeTransact(groupingInterval, fn)
  },

  deactivate() {
    atom.workspace.getTextEditors().map(editor => {
      if (editor._undoTreeTransact) {
        editor.transact = editor._undoTreeTransact
        delete editor._undoTreeTransact
      }
    })
    this.subscriptions.dispose()
  },

  serialize() {
    return {}
  }
}
