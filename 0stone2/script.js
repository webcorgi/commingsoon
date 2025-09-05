$(function(){
    particlesInit()
    mousemoveCircle()

})

function particlesInit(){
	particleground(document.getElementById('particles'), {
			dotColor: '#182987',
		lineColor: '#1829ff'
	});
}


function mousemoveCircle(){
	let $mousePointer = $('#mousemove-circle')
	$(window).on('mousemove', function(e){
			let posX = e.originalEvent.clientX;
			let posY = e.originalEvent.clientY;
			$mousePointer.css({top:posY-150, left:posX-150});
	})
}
