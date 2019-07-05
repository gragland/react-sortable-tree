import React, { Children, cloneElement, Component } from 'react';
import PropTypes from 'prop-types';

function TreePlaceholder({
  children,
  connectDropTarget,
  treeId,
  drop,
  ...otherProps
}) {
  return (
    <div ref={connectDropTarget}>
      {Children.map(children, child =>
        cloneElement(child, {
          ...otherProps,
        })
      )}
    </div>
  );
}

TreePlaceholder.defaultProps = {
  canDrop: false,
  draggedNode: null,
};

TreePlaceholder.propTypes = {
  children: PropTypes.node.isRequired,

  // Drop target
  connectDropTarget: PropTypes.func.isRequired,
  isOver           : PropTypes.bool.isRequired,
  canDrop          : PropTypes.bool,
  draggedNode      : PropTypes.shape({}),
  treeId           : PropTypes.string.isRequired,
  drop             : PropTypes.func.isRequired,
};

export default TreePlaceholder;
