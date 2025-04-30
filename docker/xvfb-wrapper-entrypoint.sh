# Entrypoint for the docker container
# Runs a command provided in $@ within a xvfb-run

THIS_FILE="$(realpath $0)"
THIS_DIR="$(dirname $THIS_FILE)"

test -d "$XVFB_DIR" || echo "$THIS_FILE: Failed because specified XVFB_DIR does not exist: $XVFB_DIR" 1>&2
test -d "$XVFB_DIR" || exit 1

export TMPDIR=$XVFB_DIR  # For xvfb auth file
XVFB_ERROR=$XVFB_DIR/err-$$.txt
SERVERNUM=99$$

sh "$THIS_DIR/xvfb-run-2.sh" --server-num $SERVERNUM --auto-servernum -e $XVFB_ERROR $@
STATUS=$?

test -s $XVFB_ERROR && echo "$THIS_FILE: Xvfb error file not empty, see below:" 1>&2 && cat $XVFB_ERROR 1>&2
rm -f $XVFB_ERROR
exit $STATUS
